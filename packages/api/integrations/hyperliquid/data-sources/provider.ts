import { Cache, Duration, Effect, Layer, Match, Ref, Schedule } from "effect";
import { normalizeCandles, parseHlRawCandles, toHlInterval } from "./normalizer";
import { normalizeSymbol } from "./symbol";
import { HyperliquidClient } from "./client";
import { HyperliquidError, TickerSnapshotError, toHyperliquidError } from "./errors";
import { HyperliquidProvider } from "./types";
import type {
  Candle,
  HyperliquidAggregatedAsset,
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
import type { MarketTimeframe } from "../../../domain/market-data/timeframe";

import { withDedup } from "./request-dedup";

/** TTL for aggregated markets cache (60s) — REST metadata, NOT real-time data. */
const AGGREGATED_MARKETS_TTL_MS = 60_000;

/**
 * Ticker snapshots are REST pictures, not the live feed: charts and the order
 * book stream over WS, and the app's price query carries a 60s staleTime.
 * 500ms collapses the widget burst on mount without letting a read observe a
 * pre-mutation book; post-mutation callers pass `{ fresh: true }`.
 */
export const TICKER_SNAPSHOT_TTL_MS = 500;

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
): Effect.Effect<Cache.Cache<string, TickerSnapshot, HyperliquidError>> =>
  Cache.make<string, TickerSnapshot, HyperliquidError>({
    capacity: limits.capacity ?? TICKER_SNAPSHOT_CACHE_CAPACITY,
    timeToLive: limits.timeToLive ?? Duration.millis(TICKER_SNAPSHOT_TTL_MS),
    lookup: (key) => getTickerSnapshotByCacheKey(info, key),
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

export const hyperliquidProviderLayer: Layer.Layer<HyperliquidProvider, never, HyperliquidClient> =
  Layer.effect(
    HyperliquidProvider,
    Effect.scoped(
      Effect.gen(function* () {
        const client = yield* HyperliquidClient;
        const hlInfo = toHyperliquidInfoClient(client.info);
        const spotIndexRef = yield* Ref.make<Record<string, string>>({});
        const tickerSnapshotCache = yield* makeTickerSnapshotCache(hlInfo);

        const readSnapshot = (symbol?: string, options?: TickerSnapshotReadOptions) =>
          readTickerSnapshot(tickerSnapshotCache, symbol, options);

        // Aggregated markets cache — REST metadata (not real-time), refreshed every 60s
        const aggregatedCache = yield* Cache.make<
          string,
          readonly HyperliquidAggregatedAsset[],
          HyperliquidError
        >({
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
          refreshPipeline.pipe(
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
              const ticker = yield* readSnapshot(coin);

              let internalSymbol: string;
              if (coin.includes("/")) {
                // Force aggregated cache to be populated (ticker resolution)
                yield* Cache.get(aggregatedCache, "aggregated");
                internalSymbol = (yield* Ref.get(spotIndexRef))[coin] ?? coin;
              } else {
                internalSymbol = resolveInternalSymbol(ticker, coin);
              }

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
            readSnapshot(symbol, options).pipe(
              // The port declares HyperliquidError, so the snapshot error is translated here
              // instead of widening the port (that widening ripples into the layer adapter).
              Effect.flatMap((s) =>
                Effect.fromResult(mapTickerFromSnapshot(s, symbol)).pipe(
                  Effect.mapError(
                    (error) => new HyperliquidError({ message: error.message, kind: error.kind }),
                  ),
                ),
              ),
            ),

          getOrderBook: (symbol, depth) =>
            Effect.gen(function* () {
              const ticker = yield* readSnapshot(symbol);

              let internalSymbol: string;
              if (symbol.includes("/")) {
                yield* Cache.get(aggregatedCache, "aggregated");
                internalSymbol = (yield* Ref.get(spotIndexRef))[symbol] ?? symbol;
              } else {
                internalSymbol = resolveInternalSymbol(ticker, symbol);
              }

              const nSigFigs = parseDepthToSigFigs(depth);

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
              const ticker = yield* readSnapshot(symbol);
              const internalSymbol = resolveInternalSymbol(ticker, symbol);
              const isPerp = isPerpSymbol(ticker, symbol);

              if (!isPerp) {
                return yield* Effect.fail(
                  new HyperliquidError({
                    message: `Asset not supported or not found in perpetuals universe: ${symbol}`,
                    kind: "NOT_FOUND",
                  }),
                );
              }

              const annotation = yield* tryRequest(
                `Failed to fetch trade annotation for ${symbol}`,
                () => client.info.perpAnnotation({ coin: internalSymbol }),
              );

              return { symbol: normalizeSymbol(symbol), annotation };
            }),
        });
      }),
    ),
  );

// Standalone query functions — direct SDK calls without layer-scoped cache.
// These are used by tests and for one-off queries from non-scoped contexts.

export const getCandleSnapshot = (
  coin: string,
  interval: MarketTimeframe,
  startTime: number,
  endTime: number,
): Effect.Effect<Candle[], HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
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
  HyperliquidClient
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
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
): Effect.Effect<TickerPayload, HyperliquidError | TickerSnapshotError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = toHyperliquidInfoClient(info);
    const snapshot = yield* getTickerSnapshot(hlInfo);
    return yield* Effect.fromResult(mapTickerFromSnapshot(snapshot, symbol));
  });

export const getOrderBook = (
  symbol: string,
  depth?: number,
): Effect.Effect<OrderBookPayload, HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = toHyperliquidInfoClient(info);
    const snapshot = yield* getTickerSnapshot(hlInfo);
    const internalSymbol = resolveInternalSymbol(snapshot, symbol);

    const nSigFigs = parseDepthToSigFigs(depth);

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
  HyperliquidClient
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = toHyperliquidInfoClient(info);
    const snapshot = yield* getTickerSnapshot(hlInfo);
    const internalSymbol = resolveInternalSymbol(snapshot, symbol);
    const isPerp = isPerpSymbol(snapshot, symbol);
    if (!isPerp) {
      return yield* Effect.fail(
        new HyperliquidError({
          message: `Asset not supported or not found in perpetuals universe: ${symbol}`,
          kind: "NOT_FOUND",
        }),
      );
    }
    const annotation = yield* Effect.tryPromise({
      try: () => info.perpAnnotation({ coin: internalSymbol }),
      catch: (cause) =>
        cause instanceof HyperliquidError
          ? cause
          : toHyperliquidError(`Failed to fetch trade annotation for ${symbol}`, cause),
    });
    return { symbol: normalizeSymbol(symbol), annotation };
  });
