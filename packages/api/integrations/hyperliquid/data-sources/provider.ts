import { Cache, Duration, Effect, Match, Ref, Result, Schedule } from "effect";
import {
  candleCountForRange,
  normalizeCandles,
  parseHlRawCandles,
  toHlInterval,
} from "./normalizer";
import { normalizeSymbol, parseSymbol } from "./symbol";
import { HyperliquidClient } from "./hyperliquid-client";
import { HyperliquidError, TickerSnapshotError, toHyperliquidError } from "./errors";
import {
  acquireCandleSnapshot,
  acquireInfo,
  acquireUnlistedInfo,
  HyperliquidRateLimiter,
  type RateLimitBudgetExhaustedError,
} from "../rate-limit";
import { INFO_WEIGHTS, UNLISTED_INFO_WEIGHT, candleSnapshotWeight } from "../weights";
import { HyperliquidProvider } from "./types";
import type {
  Candle,
  HyperliquidInfoClient,
  PerpAnnotationResponse,
  TickerPayload,
  TickerSnapshot,
  OrderBookPayload,
} from "./types";
import {
  getTickerSnapshot,
  getTickerSnapshotByCacheKey,
  getAggregatedMarketsSnapshot,
  tickerSnapshotCacheKey,
  toHyperliquidInfoClient,
} from "./mapping";
import { mapTickerFromSnapshot, resolveInternalSymbol, isPerpSymbol } from "./ticker-snapshot";
import type { MarketTimeframe } from "../../../modules/market-data";

import { withDedup } from "./request-dedup";
import { guardWithLeaderLock, MARKETS_REFRESH_LOCK_KEY } from "../../../platform/db/leader-lock";

/** TTL for aggregated markets cache (60s) — REST metadata, NOT real-time data. */
const AGGREGATED_MARKETS_TTL_MS = 60_000;

/**
 * Ticker snapshots are REST pictures, not the live feed: prices arrive on the
 * WS `allMids` stream, so this only has to collapse a widget burst on mount.
 * A read that must not observe a pre-mutation book passes `{ fresh: true }`.
 */
export const TICKER_SNAPSHOT_TTL_MS = 5_000;

/**
 * Keyed by upstream request set (all dexes, or one dex), so real cardinality is
 * the dex count plus one. The bound keeps arbitrary symbol prefixes from
 * growing the cache without limit.
 */
export const TICKER_SNAPSHOT_CACHE_CAPACITY = 64;

type TickerSnapshotReadOptions = {
  readonly fresh?: boolean | undefined;
};

export const makeTickerSnapshotCache = (
  info: HyperliquidInfoClient,
  limits: {
    readonly capacity?: number | undefined;
    readonly timeToLive?: Duration.Input | undefined;
  } = {},
): Effect.Effect<
  Cache.Cache<string, TickerSnapshot, HyperliquidError>,
  never,
  HyperliquidRateLimiter
> =>
  Cache.make({
    capacity: limits.capacity ?? TICKER_SNAPSHOT_CACHE_CAPACITY,
    timeToLive: limits.timeToLive ?? Duration.millis(TICKER_SNAPSHOT_TTL_MS),
    lookup: (key: string) => getTickerSnapshotByCacheKey(info, key),
  });

export const readTickerSnapshot = (
  cache: Cache.Cache<string, TickerSnapshot, HyperliquidError>,
  symbol?: string,
  options?: TickerSnapshotReadOptions,
): Effect.Effect<TickerSnapshot, HyperliquidError> =>
  Effect.gen(function* () {
    const key = tickerSnapshotCacheKey(symbol);
    if (options?.fresh === true) yield* Cache.invalidate(cache, key);
    return yield* Cache.get(cache, key);
  });

// Direct fetch helper with error mapping (no concurrency semaphore — SDK manages its own)
const tryRequest = <A>(label: string, fn: () => Promise<A>): Effect.Effect<A, HyperliquidError> =>
  Effect.tryPromise({
    try: fn,
    catch: (cause) => toHyperliquidError(label, cause),
  });

const parseDepthToSigFigs = (depth: number | null | undefined): 2 | 3 | 4 | 5 | null => {
  const parsedDepth = depth === null || depth === undefined ? null : Math.trunc(depth);
  return parsedDepth === 2 || parsedDepth === 3 || parsedDepth === 4 || parsedDepth === 5
    ? parsedDepth
    : null;
};

/**
 * The frontend treats the annotation as 1-hour-stale, so a 1-hour TTL costs no
 * freshness. Keyed by the resolved coin, and Effect's Cache coalesces misses.
 */
export const PERP_ANNOTATION_TTL_MS = 60 * 60 * 1_000;
const PERP_ANNOTATION_CACHE_CAPACITY = 512;

export type PerpAnnotationSource = {
  readonly perpAnnotation: (params: { coin: string }) => Promise<PerpAnnotationResponse>;
};

export const makePerpAnnotationCache = (
  info: PerpAnnotationSource,
  acquire: () => Effect.Effect<void, HyperliquidError>,
): Effect.Effect<Cache.Cache<string, PerpAnnotationResponse, HyperliquidError>> =>
  Cache.make({
    capacity: PERP_ANNOTATION_CACHE_CAPACITY,
    timeToLive: Duration.millis(PERP_ANNOTATION_TTL_MS),
    lookup: (coin: string) =>
      Effect.gen(function* () {
        yield* acquire();
        return yield* tryRequest(`Failed to fetch trade annotation for ${coin}`, () =>
          info.perpAnnotation({ coin }),
        );
      }),
  });

const toMarketError = (error: TickerSnapshotError): HyperliquidError =>
  new HyperliquidError({
    message: error.message,
    kind: error.kind,
    reason: error.reason,
    symbol: error.symbol,
    tried: error.tried,
    dexes: error.dexes,
    candidates: error.candidates,
    resolved: error.resolved,
    cause: error,
  });

/** A bare name may live on a builder dex or in the spot universe. */
const canLiveOnAnotherDex = (symbol: string): boolean => {
  const normalized = normalizeSymbol(symbol);
  return parseSymbol(symbol).kind === "perp" && !normalized.includes(":") && !symbol.includes("/");
};

export const makeHyperliquidProvider = () =>
  Effect.scoped(
    Effect.gen(function* () {
      const client = yield* HyperliquidClient;
      const limiter = yield* HyperliquidRateLimiter;
      const hlInfo = toHyperliquidInfoClient(client.info);
      const spotIndexRef = yield* Ref.make<Record<string, string>>({});
      const tickerSnapshotCache = yield* makeTickerSnapshotCache(hlInfo);
      const acquireFor = (weight: number) =>
        limiter.acquire(weight).pipe(
          Effect.mapError(
            (error: RateLimitBudgetExhaustedError) =>
              new HyperliquidError({
                message: error.message,
                kind: "RATE_LIMITED",
                cause: error,
              }),
          ),
        );

      const readSnapshot = (symbol?: string, options?: TickerSnapshotReadOptions) =>
        readTickerSnapshot(tickerSnapshotCache, symbol, options);

      const annotationCache = yield* makePerpAnnotationCache(client.info, () =>
        acquireFor(UNLISTED_INFO_WEIGHT),
      );

      type ResolvedQuery = { readonly snapshot: TickerSnapshot; readonly symbol: string };

      const resolveQuery = (
        symbol: string,
        options?: TickerSnapshotReadOptions,
      ): Effect.Effect<ResolvedQuery, HyperliquidError> =>
        Effect.gen(function* () {
          const scoped = yield* readSnapshot(symbol, options);
          const scopedResult = resolveInternalSymbol(scoped, symbol);
          if (Result.isSuccess(scopedResult)) {
            return { snapshot: scoped, symbol: scopedResult.success };
          }
          if (!canLiveOnAnotherDex(symbol)) {
            return yield* Effect.fail(toMarketError(scopedResult.failure));
          }
          const allDexs = yield* readSnapshot();
          const allResult = resolveInternalSymbol(allDexs, symbol);
          if (Result.isSuccess(allResult)) {
            return { snapshot: allDexs, symbol: allResult.success };
          }
          return yield* Effect.fail(toMarketError(allResult.failure));
        });

      // Spot pair identifiers need the spot universe's query name ("@1"), which the
      // aggregated markets index already carries; perps go through resolveQuery.
      const resolveSpotPairCoin = (symbol: string): Effect.Effect<string, HyperliquidError> =>
        Effect.gen(function* () {
          yield* Cache.get(aggregatedCache, "aggregated");
          return (yield* Ref.get(spotIndexRef))[symbol] ?? symbol;
        });

      const resolveQueryCoin = (symbol: string): Effect.Effect<string, HyperliquidError> =>
        symbol.includes("/")
          ? resolveSpotPairCoin(symbol)
          : resolveQuery(symbol).pipe(Effect.map((resolved) => resolved.symbol));

      // Aggregated markets cache — REST metadata (not real-time), refreshed every 60s
      const aggregatedCache = yield* Cache.make({
        capacity: 1,
        timeToLive: Duration.millis(AGGREGATED_MARKETS_TTL_MS),
        lookup: () => getAggregatedMarketsSnapshot(hlInfo),
      });

      // Periodic background refresh of aggregated markets + spot index
      const refreshPipeline = Effect.gen(function* () {
        const aggregatedMarkets = yield* getAggregatedMarketsSnapshot(hlInfo);

        const spotIndex: Record<string, string> = {};
        for (const asset of aggregatedMarkets) {
          if (asset.marketType === "spot") {
            spotIndex[asset.rawCoin] = asset.name;
          }
        }
        yield* Ref.set(spotIndexRef, spotIndex);
        yield* Cache.set(aggregatedCache, "aggregated", aggregatedMarkets);
      });

      yield* Effect.forkScoped(
        guardWithLeaderLock(MARKETS_REFRESH_LOCK_KEY, refreshPipeline).pipe(
          Effect.catch((err) =>
            Effect.logError(
              "[Hyperliquid] Unified refresh failed",
              Match.value(err).pipe(
                Match.when(Match.instanceOf(HyperliquidError), (e) => e.message),
                Match.when(Match.instanceOf(Error), (e) => e.message),
                Match.orElse(() => String(err)),
              ),
            ),
          ),
          Effect.repeat(Schedule.spaced("24 seconds")),
        ),
      );

      return HyperliquidProvider.of({
        getCandleSnapshot: (coin, interval, start, end) =>
          Effect.gen(function* () {
            const internalSymbol = yield* resolveQueryCoin(coin);

            yield* acquireFor(candleSnapshotWeight(candleCountForRange(interval, start, end)));
            const candles = yield* tryRequest(
              `Failed to fetch candles for ${coin} (${interval})`,
              () =>
                client.info.candleSnapshot({
                  coin: internalSymbol,
                  interval: toHlInterval(interval),
                  startTime: start,
                  endTime: end,
                }),
            );

            const raw = yield* parseHlRawCandles(candles).pipe(
              Effect.catchTag("NormalizationError", (e) =>
                Effect.fail(
                  new HyperliquidError({ message: `Candle normalization failed: ${e.message}` }),
                ),
              ),
            );
            return normalizeCandles(raw);
          }),

        getAllMids: () => readSnapshot().pipe(Effect.map((s) => s.allMids)),

        getAggregatedMarkets: () =>
          Cache.get(aggregatedCache, "aggregated").pipe(
            Effect.tap((markets) => {
              const spotIndex: Record<string, string> = {};
              for (const asset of markets) {
                if (asset.marketType === "spot") {
                  spotIndex[asset.rawCoin] = asset.name;
                }
              }
              return Ref.set(spotIndexRef, spotIndex);
            }),
          ),

        getTicker: (symbol, options?: TickerSnapshotReadOptions) =>
          Effect.gen(function* () {
            const resolved = yield* resolveQuery(symbol, options);
            return yield* Effect.fromResult(
              mapTickerFromSnapshot(resolved.snapshot, resolved.symbol),
            ).pipe(Effect.mapError(toMarketError));
          }),

        getOrderBook: (symbol, depth) =>
          Effect.gen(function* () {
            const internalSymbol = yield* resolveQueryCoin(symbol);
            const nSigFigs = parseDepthToSigFigs(depth);

            yield* acquireFor(INFO_WEIGHTS.l2Book);
            const orderbook = yield* tryRequest(`Failed to fetch orderbook for ${symbol}`, () =>
              client.info.l2Book({ coin: internalSymbol, nSigFigs }),
            );

            if (!orderbook) {
              return yield* Effect.fail(
                new HyperliquidError({
                  message: `Orderbook not available for ${internalSymbol}`,
                  kind: "NOT_FOUND",
                }),
              );
            }

            return { symbol: normalizeSymbol(symbol), nSigFigs, orderbook };
          }),

        getTradeAnnotation: (symbol) =>
          Effect.gen(function* () {
            const resolved = yield* resolveQuery(symbol);
            const isPerp = isPerpSymbol(resolved.snapshot, resolved.symbol);

            if (!isPerp) {
              return yield* Effect.fail(
                new HyperliquidError({
                  message: `Asset not supported or not found in perpetuals universe: ${symbol}`,
                  kind: "NOT_FOUND",
                }),
              );
            }

            const annotation = yield* Cache.get(annotationCache, resolved.symbol);

            return { symbol: normalizeSymbol(symbol), annotation };
          }),
      });
    }),
  );

// Standalone query functions — direct SDK calls without layer-scoped cache.
// These are used by tests and for one-off queries from non-scoped contexts.

export const getCandleSnapshot = (
  coin: string,
  interval: MarketTimeframe,
  startTime: number,
  endTime: number,
): Effect.Effect<Candle[], HyperliquidError, HyperliquidClient | HyperliquidRateLimiter> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    yield* acquireCandleSnapshot(candleCountForRange(interval, startTime, endTime));
    const candles = yield* Effect.tryPromise({
      try: () =>
        info.candleSnapshot({
          coin,
          interval: toHlInterval(interval),
          startTime,
          endTime,
        }),
      catch: (cause) =>
        toHyperliquidError(`Failed to fetch candles for ${coin} (${interval})`, cause),
    });
    const raw = yield* parseHlRawCandles(candles).pipe(
      Effect.catchTag("NormalizationError", (e) =>
        Effect.fail(new HyperliquidError({ message: `Candle normalization failed: ${e.message}` })),
      ),
    );
    return normalizeCandles(raw);
  });

export const getAllMids = (): Effect.Effect<
  Record<string, string>,
  HyperliquidError,
  HyperliquidClient | HyperliquidRateLimiter
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    yield* acquireInfo("allMids");
    return yield* Effect.tryPromise({
      try: () => withDedup("allMids", () => info.allMids()),
      catch: (cause) => toHyperliquidError("Failed to fetch all mids", cause),
    }).pipe(
      Effect.retry({
        times: 2,
        schedule: Schedule.exponential("1 seconds"),
        while: (err: HyperliquidError) => err.kind === "RATE_LIMITED",
      }),
    );
  });

export const getTicker = (
  symbol: string,
): Effect.Effect<
  TickerPayload,
  HyperliquidError | TickerSnapshotError,
  HyperliquidClient | HyperliquidRateLimiter
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = toHyperliquidInfoClient(info);
    const snapshot = yield* getTickerSnapshot(hlInfo);
    const internalSymbol = yield* Effect.fromResult(resolveInternalSymbol(snapshot, symbol));
    return yield* Effect.fromResult(mapTickerFromSnapshot(snapshot, internalSymbol));
  });

export const getOrderBook = (
  symbol: string,
  depth?: number,
): Effect.Effect<OrderBookPayload, HyperliquidError, HyperliquidClient | HyperliquidRateLimiter> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = toHyperliquidInfoClient(info);
    const snapshot = yield* getTickerSnapshot(hlInfo);
    const internalSymbol = yield* Effect.fromResult(resolveInternalSymbol(snapshot, symbol)).pipe(
      Effect.mapError(toMarketError),
    );

    const nSigFigs = parseDepthToSigFigs(depth);

    yield* acquireInfo("l2Book");
    const orderbook = yield* Effect.tryPromise({
      try: () => info.l2Book({ coin: internalSymbol, nSigFigs }),
      catch: (cause) =>
        cause instanceof HyperliquidError
          ? cause
          : toHyperliquidError(`Failed to fetch orderbook for ${symbol}`, cause),
    });
    if (!orderbook) {
      return yield* Effect.fail(
        new HyperliquidError({
          message: `Orderbook not available for ${internalSymbol}`,
          kind: "NOT_FOUND",
        }),
      );
    }
    return { symbol: normalizeSymbol(symbol), nSigFigs, orderbook };
  });

export const getTradeAnnotation = (
  symbol: string,
): Effect.Effect<
  { symbol: string; annotation: PerpAnnotationResponse },
  HyperliquidError,
  HyperliquidClient | HyperliquidRateLimiter
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = toHyperliquidInfoClient(info);
    const snapshot = yield* getTickerSnapshot(hlInfo);
    const internalSymbol = yield* Effect.fromResult(resolveInternalSymbol(snapshot, symbol)).pipe(
      Effect.mapError(toMarketError),
    );
    const isPerp = isPerpSymbol(snapshot, internalSymbol);
    if (!isPerp) {
      return yield* Effect.fail(
        new HyperliquidError({
          message: `Asset not supported or not found in perpetuals universe: ${symbol}`,
          kind: "NOT_FOUND",
        }),
      );
    }
    yield* acquireUnlistedInfo;
    const annotation = yield* Effect.tryPromise({
      try: () => info.perpAnnotation({ coin: internalSymbol }),
      catch: (cause) =>
        cause instanceof HyperliquidError
          ? cause
          : toHyperliquidError(`Failed to fetch trade annotation for ${symbol}`, cause),
    });
    return { symbol: normalizeSymbol(symbol), annotation };
  });
