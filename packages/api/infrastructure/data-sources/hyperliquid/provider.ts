import { Cache, Duration, Effect, Layer, Match, Ref, Schedule } from "effect";
import { normalizeCandles, parseHlRawCandles, toHlInterval } from "./normalizer";
import { normalizeSymbol } from "./symbol";
import { HyperliquidClient } from "./client";
import { HyperliquidRateLimiter, makeHyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";
import { HyperliquidError } from "./errors";
import { HyperliquidProvider } from "./types";
import type {
  TickerSnapshot,
  HyperliquidAggregatedAsset,
  TickerPayload,
  OrderBookPayload,
} from "./types";
import type { HyperliquidInfoClient } from "./types";
import {
  getTickerSnapshot,
  getAggregatedMarketsSnapshot,
  toHyperliquidInfoClient,
} from "./mapping";
import { mapTickerFromSnapshot, resolveInternalSymbol, isPerpSymbol } from "./ticker-snapshot";
import {
  RateLimiterSvc,
  DedupRegistrySvc,
  DedupCacheValue,
  AGGREGATED_MARKETS_TTL_MS,
  TICKER_SNAPSHOT_TTL_MS,
  provideServicesFor,
} from "./provider-cache";
import type { Candle } from "@0xsignal/shared";
import type { MarketTimeframe } from "../../../domain/market-data/timeframe";
import type { PerpAnnotationResponse } from "@nktkas/hyperliquid/api/info";
import { isRateLimitedCause } from "./errors";

export const hyperliquidProviderLayer: Layer.Layer<HyperliquidProvider, never, HyperliquidClient> =
  Layer.effect(
    HyperliquidProvider,
    Effect.scoped(
      Effect.gen(function* () {
        const client = yield* HyperliquidClient;

        // Layer-scoped rate limiter + dedup — created safely inside Effect
        const rateLimiter = yield* makeHyperliquidRateLimiter;
        const { semaphore } = rateLimiter;
        const lookupRef = yield* Ref.make<
          Map<string, Effect.Effect<DedupCacheValue, HyperliquidError>>
        >(new Map());
        const dedupCache = yield* Cache.make<string, DedupCacheValue, HyperliquidError, never>({
          capacity: 100,
          timeToLive: Duration.seconds(30),
          lookup: (key: string): Effect.Effect<DedupCacheValue, HyperliquidError, never> =>
            Ref.get(lookupRef).pipe(
              Effect.flatMap((map) => {
                const effect = map.get(key);
                if (effect) return effect;
                return Effect.die(
                  new Error(`[Hyperliquid] No dedup lookup registered for key: ${key}`),
                );
              }),
            ),
        });
        const rateLimiterSvc: RateLimiterSvc = rateLimiter;
        const dedupSvc: DedupRegistrySvc = { cache: dedupCache, lookupRef };
        const provide = provideServicesFor(rateLimiterSvc, dedupSvc);

        const hlInfo = toHyperliquidInfoClient(client.info);

        const spotIndexRef = yield* Ref.make<Record<string, string>>({});

        const aggregatedCache = yield* Cache.make<
          string,
          readonly HyperliquidAggregatedAsset[],
          HyperliquidError
        >({
          capacity: 1,
          timeToLive: Duration.millis(AGGREGATED_MARKETS_TTL_MS),
          lookup: () => provide(getAggregatedMarketsSnapshot(hlInfo)),
        });

        const tickerCache = yield* Cache.make<string, TickerSnapshot, HyperliquidError>({
          capacity: 10,
          timeToLive: Duration.millis(TICKER_SNAPSHOT_TTL_MS),
          lookup: (key: string) => provide(getTickerSnapshot(hlInfo, key)),
        });

        const fetchTickerWithCache = (
          symbol: string,
        ): Effect.Effect<TickerSnapshot, HyperliquidError> => Cache.get(tickerCache, symbol);

        const refreshPipeline = Effect.gen(function* () {
          const aggregatedMarkets = yield* provide(getAggregatedMarketsSnapshot(hlInfo));

          // Build spot name → API identifier index (e.g., "AAVE0/USDC" → "@1")
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
              const ticker = yield* fetchTickerWithCache(coin);

              // @index format required by HL API
              let internalSymbol: string;
              if (coin.includes("/")) {
                yield* Cache.get(aggregatedCache, "aggregated");
                internalSymbol = (yield* Ref.get(spotIndexRef))[coin] ?? coin;
              } else {
                internalSymbol = resolveInternalSymbol(ticker, coin);
              }

              const candles = yield* semaphore.withPermits(1)(
                Effect.tryPromise({
                  try: () =>
                    client.info.candleSnapshot({
                      coin: internalSymbol,
                      interval: toHlInterval(interval),
                      startTime: start,
                      endTime: end,
                    }),
                  catch: (cause) =>
                    new HyperliquidError({
                      message: `Failed to fetch candles for ${coin} (${interval})`,
                      cause,
                    }),
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
          getAllMids: () => fetchTickerWithCache("BTC").pipe(Effect.map((s) => s.allMids)),

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

          getTicker: (symbol) =>
            fetchTickerWithCache(symbol).pipe(Effect.map((s) => mapTickerFromSnapshot(s, symbol))),

          getOrderBook: (symbol, depth) =>
            Effect.gen(function* () {
              const ticker = yield* fetchTickerWithCache(symbol);

              // Resolve perp via universe or spot via spotIndex
              let internalSymbol: string;
              if (symbol.includes("/")) {
                yield* Cache.get(aggregatedCache, "aggregated");
                internalSymbol = (yield* Ref.get(spotIndexRef))[symbol] ?? symbol;
              } else {
                internalSymbol = resolveInternalSymbol(ticker, symbol);
              }

              const parsedDepth = depth === undefined ? undefined : Math.trunc(depth);
              const nSigFigs: 2 | 3 | 4 | 5 | undefined =
                parsedDepth === 2 || parsedDepth === 3 || parsedDepth === 4 || parsedDepth === 5
                  ? parsedDepth
                  : undefined;

              const orderbook = yield* semaphore.withPermits(1)(
                Effect.tryPromise({
                  try: () => client.info.l2Book({ coin: internalSymbol, nSigFigs }),
                  catch: (cause) =>
                    new HyperliquidError({
                      message: `Failed to fetch orderbook for ${symbol}`,
                      kind: "UPSTREAM",
                      cause,
                    }),
                }),
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
              const ticker = yield* fetchTickerWithCache(symbol);
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

              const annotation = yield* semaphore.withPermits(1)(
                Effect.tryPromise({
                  try: () => client.info.perpAnnotation({ coin: internalSymbol }),
                  catch: (cause) =>
                    new HyperliquidError({
                      message: `Failed to fetch trade annotation for ${symbol}`,
                      cause,
                    }),
                }),
              );

              return { symbol: normalizeSymbol(symbol), annotation };
            }),
        });
      }),
    ),
  );

// Standalone query functions — require HyperliquidClient + rate limiter + dedup from Context.

const fetchTickerOnce = (
  hlInfo: HyperliquidInfoClient,
): Effect.Effect<
  TickerSnapshot,
  HyperliquidError,
  HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> => getTickerSnapshot(hlInfo);

export const getCandleSnapshot = (
  coin: string,
  interval: MarketTimeframe,
  startTime: number,
  endTime: number,
): Effect.Effect<
  Candle[],
  HyperliquidError,
  HyperliquidClient | HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = toHyperliquidInfoClient(info);
    const snapshot = yield* getTickerSnapshot(hlInfo, coin);
    const internalSymbol = resolveInternalSymbol(snapshot, coin);
    return yield* Effect.tryPromise({
      try: () =>
        info.candleSnapshot({
          coin: internalSymbol,
          interval: toHlInterval(interval),
          startTime,
          endTime,
        }),
      catch: (cause) =>
        new HyperliquidError({
          message: `Failed to fetch candles for ${coin} (${interval})`,
          cause,
        }),
    }).pipe(
      Effect.flatMap((candles) => parseHlRawCandles(candles)),
      Effect.catchTag("NormalizationError", (e) =>
        Effect.fail(new HyperliquidError({ message: `Candle normalization failed: ${e.message}` })),
      ),
      Effect.map((raw) => normalizeCandles(raw)),
    );
  });

export const getAllMids = (): Effect.Effect<
  Record<string, string>,
  HyperliquidError,
  HyperliquidClient
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    return yield* Effect.tryPromise({
      try: () => info.allMids(),
      catch: (cause) =>
        new HyperliquidError({
          message: "Failed to fetch all mids",
          kind: isRateLimitedCause(cause) ? "RATE_LIMITED" : "UPSTREAM",
          cause,
        }),
    });
  });

export const getTicker = (
  symbol: string,
): Effect.Effect<
  TickerPayload,
  HyperliquidError,
  HyperliquidClient | HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = toHyperliquidInfoClient(info);
    const snapshot = yield* fetchTickerOnce(hlInfo);
    return mapTickerFromSnapshot(snapshot, symbol);
  });

export const getOrderBook = (
  symbol: string,
  depth?: number,
): Effect.Effect<
  OrderBookPayload,
  HyperliquidError,
  HyperliquidClient | HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = toHyperliquidInfoClient(info);
    const snapshot = yield* fetchTickerOnce(hlInfo);
    const internalSymbol = resolveInternalSymbol(snapshot, symbol);

    const parsedDepth = depth === undefined ? undefined : Math.trunc(depth);
    const nSigFigs: 2 | 3 | 4 | 5 | undefined =
      parsedDepth === 2 || parsedDepth === 3 || parsedDepth === 4 || parsedDepth === 5
        ? parsedDepth
        : undefined;

    const orderbook = yield* Effect.tryPromise({
      try: () => info.l2Book({ coin: internalSymbol, nSigFigs }),
      catch: (cause) =>
        cause instanceof HyperliquidError
          ? cause
          : new HyperliquidError({
              message: `Failed to fetch orderbook for ${symbol}`,
              kind: "UPSTREAM",
              cause,
            }),
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
  HyperliquidClient | HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = toHyperliquidInfoClient(info);
    const snapshot = yield* fetchTickerOnce(hlInfo);
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
          : new HyperliquidError({
              message: `Failed to fetch trade annotation for ${symbol}`,
              cause,
            }),
    });
    return { symbol: normalizeSymbol(symbol), annotation };
  });
