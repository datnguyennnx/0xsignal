import { Clock, Deferred, Effect, Fiber, Layer, Ref, Schedule } from "effect";
import { makeUnsafe as makeSemaphoreUnsafe } from "effect/Semaphore";
import { normalizeCandles, parseHlRawCandles, toHlInterval } from "./normalizer";
import { normalizeSymbol } from "./symbol";
import { HyperliquidClient } from "./client";
import { HyperliquidError } from "./errors";
import { HyperliquidProvider } from "./types";
import type { TickerSnapshot, HyperliquidAggregatedAsset } from "./types";
import type { HyperliquidInfoClient } from "./mapping";
import { getTickerSnapshotEffect, getAggregatedMarketsSnapshot } from "./mapping";
import { mapTickerFromSnapshot, resolveInternalSymbol, isPerpSymbol } from "./mapping.pure";
import {
  CacheSlot,
  RateLimiterSvc,
  DedupRegistrySvc,
  AGGREGATED_MARKETS_TTL_MS,
  TICKER_SNAPSHOT_TTL_MS,
  provideServicesFor,
} from "./provider-cache";

export {
  getCandleSnapshot,
  getAllMids,
  getTicker,
  getOrderBook,
  getTradeAnnotation,
} from "./provider-queries";

// Runs every 24s as a daemon fiber. Fetches ticker + aggregated markets.
const makeRefreshPipeline = (
  info: HyperliquidInfoClient,
  provide: ReturnType<typeof provideServicesFor>,
  aggregatedSlot: Ref.Ref<CacheSlot<readonly HyperliquidAggregatedAsset[]>>,
  spotIndexRef: Ref.Ref<Record<string, string>>
): Effect.Effect<void, HyperliquidError> =>
  Effect.gen(function* () {
    const aggregatedMarkets = yield* provide(getAggregatedMarketsSnapshot(info));

    // Build spot name → API identifier index (e.g., "AAVE0/USDC" → "@1")
    const spotIndex: Record<string, string> = {};
    for (const asset of aggregatedMarkets) {
      if (asset.marketType === "spot") {
        spotIndex[asset.rawCoin] = asset.name;
      }
    }
    yield* Ref.set(spotIndexRef, spotIndex);

    const now = yield* Clock.currentTimeMillis;
    yield* Ref.set(aggregatedSlot, {
      value: aggregatedMarkets,
      expiresAt: now + AGGREGATED_MARKETS_TTL_MS,
    });
  });

export const hyperliquidProviderLayer: Layer.Layer<HyperliquidProvider, never, HyperliquidClient> =
  Layer.effect(
    HyperliquidProvider,
    Effect.scoped(
      Effect.gen(function* () {
        const client = yield* HyperliquidClient;

        const innerSemaphore = makeSemaphoreUnsafe(6);
        const innerDedupRef = Ref.makeUnsafe(
          new Map<string, Deferred.Deferred<any, HyperliquidError>>()
        );
        const rateLimiterSvc: RateLimiterSvc = { semaphore: innerSemaphore };
        const dedupSvc: DedupRegistrySvc = { registryRef: innerDedupRef };
        const provide = provideServicesFor(rateLimiterSvc, dedupSvc);

        const hlInfo = client.info as unknown as HyperliquidInfoClient;

        const tickerSlots = yield* Ref.make<Map<string, CacheSlot<TickerSnapshot>>>(new Map());
        const aggregatedSlot = yield* Ref.make<CacheSlot<readonly HyperliquidAggregatedAsset[]>>({
          expiresAt: 0,
        });
        const spotIndexRef = yield* Ref.make<Record<string, string>>({});

        const fetchWithCache = <T>(
          slot: Ref.Ref<CacheSlot<T>>,
          ttlMs: number,
          fetch: Effect.Effect<T, HyperliquidError>
        ): Effect.Effect<T, HyperliquidError> =>
          Effect.gen(function* () {
            const cached = yield* Ref.get(slot);
            const now = yield* Clock.currentTimeMillis;
            if (cached.value !== undefined && cached.expiresAt > now) {
              return cached.value;
            }
            const value = yield* fetch;
            yield* Ref.set(slot, { value, expiresAt: now + ttlMs });
            return value;
          });

        const fetchTickerWithCache = (
          symbol: string
        ): Effect.Effect<TickerSnapshot, HyperliquidError> =>
          Effect.gen(function* () {
            const normalized = normalizeSymbol(symbol);
            let dex = "";
            if (normalized.includes(":")) {
              dex = normalized.split(":")[0].toLowerCase();
            }

            const now = yield* Clock.currentTimeMillis;
            const slots = yield* Ref.get(tickerSlots);
            const cached = slots.get(dex);
            if (cached !== undefined && cached.expiresAt > now && cached.value !== undefined) {
              return cached.value;
            }

            const value = yield* provide(getTickerSnapshotEffect(hlInfo, symbol));
            yield* Ref.update(tickerSlots, (map) => {
              const newMap = new Map(map);
              newMap.set(dex, { value, expiresAt: now + TICKER_SNAPSHOT_TTL_MS });
              return newMap;
            });
            return value;
          });

        const pipeline = makeRefreshPipeline(hlInfo, provide, aggregatedSlot, spotIndexRef);

        const refreshFiber = yield* Effect.forkDetach(
          pipeline.pipe(
            Effect.catch((err) =>
              Effect.logError(
                `[Hyperliquid] Unified refresh failed: ${(err as HyperliquidError).message}`
              )
            ),
            Effect.repeat(Schedule.spaced("24 seconds"))
          )
        );

        yield* Effect.addFinalizer(() => Fiber.interrupt(refreshFiber));

        return HyperliquidProvider.of({
          getCandleSnapshot: (coin, interval, start, end) =>
            Effect.gen(function* () {
              const ticker = yield* fetchTickerWithCache(coin);

              // Resolve perp via universe or spot via spotIndex (@index format required by HL API)
              let internalSymbol: string;
              if (coin.includes("/")) {
                yield* fetchWithCache(
                  aggregatedSlot,
                  AGGREGATED_MARKETS_TTL_MS,
                  provide(getAggregatedMarketsSnapshot(hlInfo))
                );
                internalSymbol = (yield* Ref.get(spotIndexRef))[coin] ?? coin;
              } else {
                internalSymbol = resolveInternalSymbol(ticker, coin);
              }

              const candles = yield* rateLimiterSvc.semaphore.withPermits(1)(
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
                })
              );

              return normalizeCandles(parseHlRawCandles(candles));
            }),
          getAllMids: () => fetchTickerWithCache("BTC").pipe(Effect.map((s) => s.allMids)),

          getAggregatedMarkets: () =>
            fetchWithCache(
              aggregatedSlot,
              AGGREGATED_MARKETS_TTL_MS,
              provide(getAggregatedMarketsSnapshot(hlInfo))
            ).pipe(
              Effect.tap((markets) => {
                const spotIndex: Record<string, string> = {};
                for (const asset of markets) {
                  if (asset.marketType === "spot") {
                    spotIndex[asset.rawCoin] = asset.name;
                  }
                }
                return Ref.set(spotIndexRef, spotIndex);
              })
            ),

          getTicker: (symbol) =>
            fetchTickerWithCache(symbol).pipe(Effect.map((s) => mapTickerFromSnapshot(s, symbol))),

          getOrderBook: (symbol, depth) =>
            Effect.gen(function* () {
              const ticker = yield* fetchTickerWithCache(symbol);

              // Resolve perp via universe or spot via spotIndex
              let internalSymbol: string;
              if (symbol.includes("/")) {
                yield* fetchWithCache(
                  aggregatedSlot,
                  AGGREGATED_MARKETS_TTL_MS,
                  provide(getAggregatedMarketsSnapshot(hlInfo))
                );
                internalSymbol = (yield* Ref.get(spotIndexRef))[symbol] ?? symbol;
              } else {
                internalSymbol = resolveInternalSymbol(ticker, symbol);
              }

              const parsedDepth = depth === undefined ? undefined : Math.trunc(depth);
              const nSigFigs: 2 | 3 | 4 | 5 | undefined =
                parsedDepth === 2 || parsedDepth === 3 || parsedDepth === 4 || parsedDepth === 5
                  ? parsedDepth
                  : undefined;

              const orderbook = yield* rateLimiterSvc.semaphore.withPermits(1)(
                Effect.tryPromise({
                  try: () => client.info.l2Book({ coin: internalSymbol, nSigFigs }),
                  catch: (cause) =>
                    new HyperliquidError({
                      message: `Failed to fetch orderbook for ${symbol}`,
                      kind: "UPSTREAM",
                      cause,
                    }),
                })
              );

              if (!orderbook) {
                return yield* Effect.fail(
                  new HyperliquidError({
                    message: `Orderbook not available for ${internalSymbol}`,
                    kind: "NOT_FOUND",
                  })
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
                  })
                );
              }

              const annotation = yield* rateLimiterSvc.semaphore.withPermits(1)(
                Effect.tryPromise({
                  try: () => client.info.perpAnnotation({ coin: internalSymbol }),
                  catch: (cause) =>
                    new HyperliquidError({
                      message: `Failed to fetch trade annotation for ${symbol}`,
                      cause,
                    }),
                })
              );

              return { symbol: normalizeSymbol(symbol), annotation };
            }),
        });
      })
    )
  );
