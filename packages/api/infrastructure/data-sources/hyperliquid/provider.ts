import { Clock, Deferred, Effect, Fiber, Layer, Ref, Schedule } from "effect";
import { normalizeCandles, parseHlRawCandles, toHlInterval } from "./normalizer";
import { normalizeSymbol } from "./symbol";
import { type Candle } from "../../../schemas/market-data";
import type { MarketTimeframe } from "../../../domain/market-data/timeframe";
import { HyperliquidClient } from "./client";
import type { PerpAnnotationResponse } from "@nktkas/hyperliquid/api/info";
import { HyperliquidError, isRateLimitedCause } from "./errors";
import { HyperliquidProvider } from "./types";
import type {
  TickerPayload,
  OrderBookPayload,
  TickerSnapshot,
  AggregatedTradeAsset,
} from "./types";
import type { HyperliquidInfoClient } from "./mapping";
import { getTickerSnapshotEffect, getAggregatedMarketsSnapshot } from "./mapping";
import { mapTickerFromSnapshot, resolveInternalSymbol, isPerpSymbol } from "./mapping.pure";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";

type CacheSlot<T> = {
  readonly value?: T;
  readonly expiresAt: number;
};

// Service shape types – used to avoid Context.Tag type inference issues
type RateLimiterSvc = { readonly semaphore: Effect.Semaphore };
type DedupRegistrySvc = {
  readonly registryRef: Ref.Ref<Map<string, Deferred.Deferred<any, HyperliquidError>>>;
};

// ─── Standalone provider functions (used by tests) ─────────────────────────
// These get HyperliquidClient from Context and perform a single operation.
// Rate limiting uses optional shared semaphore; defaults to a local one if unset.

const standaloneProvide = <A, E>(
  effect: Effect.Effect<A, E, HyperliquidRateLimiter | HyperliquidDeduplicationRegistry>,
  semaphore?: Effect.Semaphore,
  dedupRef?: Ref.Ref<Map<string, Deferred.Deferred<any, HyperliquidError>>>
): Effect.Effect<A, E> => {
  const rs: RateLimiterSvc = semaphore
    ? { semaphore }
    : { semaphore: Effect.unsafeMakeSemaphore(6) };
  const ds: DedupRegistrySvc = dedupRef
    ? { registryRef: dedupRef }
    : { registryRef: Ref.unsafeMake(new Map()) };
  return effect.pipe(
    Effect.provideService(HyperliquidRateLimiter, rs),
    Effect.provideService(HyperliquidDeduplicationRegistry, ds)
  );
};

export const getCandleSnapshot = (
  coin: string,
  interval: MarketTimeframe,
  startTime: number,
  endTime: number
): Effect.Effect<Candle[], HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = info as unknown as HyperliquidInfoClient;
    const snapshot = yield* standaloneProvide(getTickerSnapshotEffect(hlInfo, coin));
    const internalSymbol = resolveInternalSymbol(snapshot, coin);
    return yield* standaloneProvide(
      Effect.tryPromise({
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
      }).pipe(Effect.map((candles) => normalizeCandles(parseHlRawCandles(candles))))
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

const fetchTickerOnce = (
  hlInfo: HyperliquidInfoClient
): Effect.Effect<TickerSnapshot, HyperliquidError> =>
  standaloneProvide(getTickerSnapshotEffect(hlInfo));

export const getTicker = (
  symbol: string
): Effect.Effect<TickerPayload, HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = info as unknown as HyperliquidInfoClient;
    const snapshot = yield* fetchTickerOnce(hlInfo);
    return mapTickerFromSnapshot(snapshot, symbol);
  });

export const getOrderBook = (
  symbol: string,
  depth?: number
): Effect.Effect<OrderBookPayload, HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = info as unknown as HyperliquidInfoClient;
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
        })
      );
    }
    return { symbol: normalizeSymbol(symbol), nSigFigs, orderbook };
  });

export const getTradeAnnotation = (
  symbol: string
): Effect.Effect<
  { symbol: string; annotation: PerpAnnotationResponse },
  HyperliquidError,
  HyperliquidClient
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = info as unknown as HyperliquidInfoClient;
    const snapshot = yield* fetchTickerOnce(hlInfo);
    const internalSymbol = resolveInternalSymbol(snapshot, symbol);
    const isPerp = isPerpSymbol(snapshot, symbol);
    if (!isPerp) {
      return yield* Effect.fail(
        new HyperliquidError({
          message: `Asset not supported or not found in perpetuals universe: ${symbol}`,
          kind: "NOT_FOUND",
        })
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

// ── TTL Constants ──────────────────────────────────────────────────────────
const AGGREGATED_MARKETS_TTL_MS = 60_000;
const TICKER_SNAPSHOT_TTL_MS = 30_000;
// ─── Context-wiring helper ─────────────────────────────────────────────────

/**
 * Returns a function that provides both the rate limiter and dedup registry
 * to an effect that requires them.
 */
const provideServicesFor =
  (rateLimiter: RateLimiterSvc, dedup: DedupRegistrySvc) =>
  <A, E>(
    effect: Effect.Effect<A, E, HyperliquidRateLimiter | HyperliquidDeduplicationRegistry>
  ): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.provideService(HyperliquidRateLimiter, rateLimiter),
      Effect.provideService(HyperliquidDeduplicationRegistry, dedup)
    );

// ─── Unified refresh pipeline (used by Layer.scoped) ───────────────────────
//
// Runs every 24 seconds as a daemon fiber.  Fetches ticker + aggregated
// markets in a single concurrent pass.  Dedup ensures shared API calls
// (perpDexs, allMids, metaAndAssetCtxs) are made only once per refresh.

const makeRefreshPipeline = (
  info: HyperliquidInfoClient,
  provide: ReturnType<typeof provideServicesFor>,
  aggregatedSlot: Ref.Ref<CacheSlot<readonly AggregatedTradeAsset[]>>,
  spotIndexRef: Ref.Ref<Record<string, string>>
): Effect.Effect<void, HyperliquidError> =>
  Effect.gen(function* () {
    const aggregatedMarkets = yield* provide(getAggregatedMarketsSnapshot(info));

    // Build spot name → API identifier index (e.g., "AAVE0/USDC" → "@1")
    // This is needed because Hyperliquid API uses @index format for spot coins
    // in endpoints like candleSnapshot and l2Book.
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

// ─── HyperliquidProviderLayer (production Layer) ──────────────────────────
//
// Uses Layer.effect with Effect.scoped to manage the daemon refresh fiber.
// Creates rate limiter and dedup services inline (self-contained).
// Only requires HyperliquidClient from Context.

export const HyperliquidProviderLayer: Layer.Layer<HyperliquidProvider, never, HyperliquidClient> =
  Layer.effect(
    HyperliquidProvider,
    Effect.scoped(
      Effect.gen(function* () {
        const client = yield* HyperliquidClient;

        // Create rate limiter and dedup services inline (self-contained)
        const innerSemaphore = Effect.unsafeMakeSemaphore(6);
        const innerDedupRef = Ref.unsafeMake(
          new Map<string, Deferred.Deferred<any, HyperliquidError>>()
        );
        const rateLimiterSvc: RateLimiterSvc = { semaphore: innerSemaphore };
        const dedupSvc: DedupRegistrySvc = { registryRef: innerDedupRef };
        const provide = provideServicesFor(rateLimiterSvc, dedupSvc);

        const hlInfo = client.info as unknown as HyperliquidInfoClient;

        // ── Ref-based cache slots ───────────────────────────────────
        const tickerSlots = yield* Ref.make<Map<string, CacheSlot<TickerSnapshot>>>(new Map());
        const aggregatedSlot = yield* Ref.make<CacheSlot<readonly AggregatedTradeAsset[]>>({
          expiresAt: 0,
        });
        // Maps spot display pair "AAVE0/USDC" → API identifier "@1"
        const spotIndexRef = yield* Ref.make<Record<string, string>>({});

        // ── Scoped helper: read with on-demand fallback ─────────────
        const readOrFetch = <T>(
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
            yield* Ref.set(slot, {
              value,
              expiresAt: now + ttlMs,
            });
            return value;
          });

        // ── Symbol-targeted DEX meta read helper ────────────────────
        const readOrFetchTickerForSymbol = (
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

        // ── Daemon background refresh fiber ─────────────────────────
        const pipeline = makeRefreshPipeline(hlInfo, provide, aggregatedSlot, spotIndexRef);

        const refreshFiber = yield* Effect.forkDaemon(
          pipeline.pipe(
            Effect.repeat(Schedule.spaced("24 seconds")),
            Effect.catchAll((err) =>
              Effect.logError(
                `[Hyperliquid] Unified refresh failed: ${(err as HyperliquidError).message}`
              )
            )
          )
        );

        // Register fiber interrupt as scope finalizer
        yield* Effect.addFinalizer(() => Fiber.interrupt(refreshFiber));

        return HyperliquidProvider.of({
          // ── getCandleSnapshot ─────────────────────────────────
          getCandleSnapshot: (coin, interval, start, end) =>
            Effect.gen(function* () {
              const ticker = yield* readOrFetchTickerForSymbol(coin);

              // Resolve the API-level coin identifier:
              //   - Perps: resolved via perp universe (resolveInternalSymbol)
              //   - Spot:  resolved via spotIndex (e.g., "AAVE0/USDC" → "@227")
              //     because the Hyperliquid API requires @index format for spot.
              //     The spotIndexRef is populated as a side-effect of fetching
              //     aggregated markets — eagerly trigger it if not yet cached.
              let internalSymbol: string;
              if (coin.includes("/")) {
                yield* readOrFetch(
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
          // ── getAllMids ────────────────────────────────────────
          getAllMids: () => readOrFetchTickerForSymbol("BTC").pipe(Effect.map((s) => s.allMids)),

          // ── getAggregatedMarkets ──────────────────────────────
          getAggregatedMarkets: () =>
            readOrFetch(
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

          // ── getTicker ─────────────────────────────────────────
          getTicker: (symbol) =>
            readOrFetchTickerForSymbol(symbol).pipe(
              Effect.map((s) => mapTickerFromSnapshot(s, symbol))
            ),

          // ── getOrderBook ──────────────────────────────────────
          getOrderBook: (symbol, depth) =>
            Effect.gen(function* () {
              const ticker = yield* readOrFetchTickerForSymbol(symbol);

              // Resolve the API-level coin identifier (same as candleSnapshot):
              //   - Perps: via perp universe (resolveInternalSymbol)
              //   - Spot:  via spotIndex (e.g., "AAVE0/USDC" → "@227")
              let internalSymbol: string;
              if (symbol.includes("/")) {
                yield* readOrFetch(
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
                  try: () =>
                    client.info.l2Book({
                      coin: internalSymbol,
                      nSigFigs,
                    }),
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

              return {
                symbol: normalizeSymbol(symbol),
                nSigFigs,
                orderbook,
              };
            }),

          // ── getTradeAnnotation ────────────────────────────────
          getTradeAnnotation: (symbol) =>
            Effect.gen(function* () {
              const ticker = yield* readOrFetchTickerForSymbol(symbol);
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
                  try: () =>
                    client.info.perpAnnotation({
                      coin: internalSymbol,
                    }),
                  catch: (cause) =>
                    new HyperliquidError({
                      message: `Failed to fetch trade annotation for ${symbol}`,
                      cause,
                    }),
                })
              );

              return {
                symbol: normalizeSymbol(symbol),
                annotation,
              };
            }),
        });
      })
    )
  );
