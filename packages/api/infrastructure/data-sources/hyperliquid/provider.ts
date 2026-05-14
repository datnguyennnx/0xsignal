import { Context, Deferred, Effect, Fiber, Layer, Ref, Schedule } from "effect";
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
import {
  mapTickerFromSnapshot,
  getTickerSnapshotEffect,
  getAggregatedMarketsSnapshot,
  resolveInternalSymbol,
  isPerpSymbol,
} from "./mapping";
import { type CacheSlot } from "./cache";
import { createLruCache } from "./cache-lru";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";

type HyperliquidClientService = Context.Tag.Service<typeof HyperliquidClient>;

// Service shape types – used to avoid Context.Tag type inference issues
type RateLimiterService = { readonly semaphore: Effect.Semaphore };
type DedupRegistryService = {
  readonly registryRef: Ref.Ref<Map<string, Deferred.Deferred<any, HyperliquidError>>>;
};

// ─── Standalone provider functions (backward-compat, used by tests) ────────
// These get HyperliquidClient from Context and perform a single operation.
// They create their own semaphore (no cross-call dedup) for rate limiting.

const standaloneProvide = <A, E>(
  effect: Effect.Effect<A, E, HyperliquidRateLimiter | HyperliquidDeduplicationRegistry>
): Effect.Effect<A, E> => {
  const semaphore = Effect.unsafeMakeSemaphore(6);
  const dedupRef = Ref.unsafeMake(new Map<string, Deferred.Deferred<any, HyperliquidError>>());
  return effect.pipe(
    Effect.provideService(HyperliquidRateLimiter, { semaphore }),
    Effect.provideService(HyperliquidDeduplicationRegistry, {
      registryRef: dedupRef,
    })
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
    const snapshot = yield* standaloneProvide(getTickerSnapshotEffect(hlInfo));
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

    const semaphore = Effect.unsafeMakeSemaphore(6);
    const orderbook = yield* semaphore.withPermits(1)(
      Effect.tryPromise({
        try: () => info.l2Book({ coin: internalSymbol, nSigFigs }),
        catch: (cause) =>
          cause instanceof HyperliquidError
            ? cause
            : new HyperliquidError({
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
    const semaphore = Effect.unsafeMakeSemaphore(6);
    const annotation = yield* semaphore.withPermits(1)(
      Effect.tryPromise({
        try: () => info.perpAnnotation({ coin: internalSymbol }),
        catch: (cause) =>
          cause instanceof HyperliquidError
            ? cause
            : new HyperliquidError({
                message: `Failed to fetch trade annotation for ${symbol}`,
                cause,
              }),
      })
    );
    return { symbol: normalizeSymbol(symbol), annotation };
  });

// ── TTL Constants ──────────────────────────────────────────────────────────
const AGGREGATED_MARKETS_TTL_MS = 60_000;
const TICKER_SNAPSHOT_TTL_MS = 30_000;
const CANDLE_SNAPSHOT_TTL_MS = 10_000;
const TRADE_ANNOTATION_TTL_MS = 6 * 60 * 60 * 1000;

// ─── Context-wiring helper ─────────────────────────────────────────────────

/**
 * Returns a function that provides both the rate limiter and dedup registry
 * to an effect that requires them.
 */
const provideServicesFor =
  (rateLimiter: RateLimiterService, dedup: DedupRegistryService) =>
  <A, E>(
    effect: Effect.Effect<A, E, HyperliquidRateLimiter | HyperliquidDeduplicationRegistry>
  ): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.provideService(HyperliquidRateLimiter, rateLimiter),
      Effect.provideService(HyperliquidDeduplicationRegistry, dedup)
    );

// ─── Shared on-demand fetch helpers ────────────────────────────────────────

/**
 * Read the ticker snapshot cache; on miss or expiry, call the API on-demand,
 * refresh the cache, and return the snapshot.  Used by provider methods that
 * depend on the ticker snapshot for symbol resolution.
 */
const ensureTickerSnapshot = (
  info: HyperliquidInfoClient,
  provide: ReturnType<typeof provideServicesFor>,
  tickerCache: {
    value: TickerSnapshot | undefined;
    expiresAt: number;
  }
): Effect.Effect<TickerSnapshot, HyperliquidError> =>
  Effect.gen(function* () {
    const now = Date.now();
    if (tickerCache.value !== undefined && tickerCache.expiresAt > now) {
      return tickerCache.value;
    }
    const snapshot = yield* provide(getTickerSnapshotEffect(info));
    tickerCache.value = snapshot;
    tickerCache.expiresAt = now + TICKER_SNAPSHOT_TTL_MS;
    return snapshot;
  });

// ─── HyperliquidProviderLive (backward-compat factory) ─────────────────────
//
// Used by unit tests.  Creates an in-process provider without a background
// refresh fiber.  Caching is on-demand: the first call fetches from the API
// (respecting rate-limiting and dedup), subsequent calls within the TTL
// return the cached value.

export const HyperliquidProviderLive = (client: HyperliquidClientService) => {
  const semaphore = Effect.unsafeMakeSemaphore(6);
  const dedupRegRef = Ref.unsafeMake(new Map<string, Deferred.Deferred<any, HyperliquidError>>());

  const rateLimiterSvc: RateLimiterService = { semaphore };
  const dedupSvc: DedupRegistryService = { registryRef: dedupRegRef };
  const provide = provideServicesFor(rateLimiterSvc, dedupSvc);

  // Mutable cache slots (plain objects – not Refs – for test simplicity)
  let aggregatedMarketsCache: CacheSlot<readonly AggregatedTradeAsset[]> = {
    expiresAt: 0,
  };
  const tickerCache: {
    value: TickerSnapshot | undefined;
    expiresAt: number;
  } = { value: undefined, expiresAt: 0 };
  const candleSnapshotCache = createLruCache<CacheSlot<Candle[]>>(1000);
  const tradeAnnotationCache =
    createLruCache<CacheSlot<{ symbol: string; annotation: PerpAnnotationResponse }>>(1000);

  const hlInfo = client.info as unknown as HyperliquidInfoClient;

  return HyperliquidProvider.of({
    // ── getCandleSnapshot ───────────────────────────────────────────
    getCandleSnapshot: (coin, interval, start, end) =>
      Effect.gen(function* () {
        const cacheKey = `${coin}|${interval}|${start}|${end}`;
        const slot = candleSnapshotCache.get(cacheKey) ?? { expiresAt: 0 };
        candleSnapshotCache.set(cacheKey, slot);

        const now = Date.now();
        if (slot.value !== undefined && slot.expiresAt > now) {
          return slot.value;
        }

        const snapshot = yield* ensureTickerSnapshot(hlInfo, provide, tickerCache);
        const internalSymbol = resolveInternalSymbol(snapshot, coin);

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
          })
        );

        const normalized = normalizeCandles(parseHlRawCandles(candles));
        slot.value = normalized;
        slot.expiresAt = Date.now() + CANDLE_SNAPSHOT_TTL_MS;
        return normalized;
      }),

    // ── getAllMids ──────────────────────────────────────────────────
    getAllMids: () =>
      Effect.gen(function* () {
        const snapshot = yield* ensureTickerSnapshot(hlInfo, provide, tickerCache);
        return snapshot.allMids;
      }),

    // ── getAggregatedMarkets ────────────────────────────────────────
    getAggregatedMarkets: () =>
      Effect.gen(function* () {
        const now = Date.now();
        if (aggregatedMarketsCache.value !== undefined && aggregatedMarketsCache.expiresAt > now) {
          return aggregatedMarketsCache.value;
        }
        const markets = yield* provide(getAggregatedMarketsSnapshot(hlInfo));
        aggregatedMarketsCache.value = markets;
        aggregatedMarketsCache.expiresAt = now + AGGREGATED_MARKETS_TTL_MS;
        return markets;
      }),

    // ── getTicker ───────────────────────────────────────────────────
    getTicker: (symbol) =>
      Effect.gen(function* () {
        const snapshot = yield* ensureTickerSnapshot(hlInfo, provide, tickerCache);
        return mapTickerFromSnapshot(snapshot, symbol);
      }),

    // ── getOrderBook ────────────────────────────────────────────────
    getOrderBook: (symbol, depth) =>
      Effect.gen(function* () {
        const snapshot = yield* ensureTickerSnapshot(hlInfo, provide, tickerCache);
        const internalSymbol = resolveInternalSymbol(snapshot, symbol);

        const parsedDepth = depth === undefined ? undefined : Math.trunc(depth);
        const nSigFigs: 2 | 3 | 4 | 5 | undefined =
          parsedDepth === 2 || parsedDepth === 3 || parsedDepth === 4 || parsedDepth === 5
            ? parsedDepth
            : undefined;

        const orderbook = yield* semaphore.withPermits(1)(
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

    // ── getTradeAnnotation ──────────────────────────────────────────
    getTradeAnnotation: (symbol) =>
      Effect.gen(function* () {
        const cacheKey = symbol.toLowerCase();
        const slot = tradeAnnotationCache.get(cacheKey) ?? { expiresAt: 0 };
        tradeAnnotationCache.set(cacheKey, slot);

        const now = Date.now();
        if (slot.value !== undefined && slot.expiresAt > now) {
          return slot.value;
        }

        const snapshot = yield* ensureTickerSnapshot(hlInfo, provide, tickerCache);
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

        const annotation = yield* semaphore.withPermits(1)(
          Effect.tryPromise({
            try: () => client.info.perpAnnotation({ coin: internalSymbol }),
            catch: (cause) =>
              new HyperliquidError({
                message: `Failed to fetch trade annotation for ${symbol}`,
                cause,
              }),
          })
        );

        const result = {
          symbol: normalizeSymbol(symbol),
          annotation,
        };
        slot.value = result;
        slot.expiresAt = Date.now() + TRADE_ANNOTATION_TTL_MS;
        return result;
      }),
  }) as unknown as HyperliquidProvider;
};

// ─── Unified refresh pipeline (used by Layer.scoped) ───────────────────────
//
// Runs every 24 seconds as a daemon fiber.  Fetches ticker + aggregated
// markets in a single concurrent pass.  Dedup ensures shared API calls
// (perpDexs, allMids, metaAndAssetCtxs) are made only once per refresh.

const makeRefreshPipeline = (
  info: HyperliquidInfoClient,
  provide: ReturnType<typeof provideServicesFor>,
  tickerSlot: Ref.Ref<CacheSlot<TickerSnapshot>>,
  aggregatedSlot: Ref.Ref<CacheSlot<readonly AggregatedTradeAsset[]>>
): Effect.Effect<void, HyperliquidError> =>
  Effect.gen(function* () {
    // Fetch ticker snapshot and aggregated markets concurrently.
    // Internally they share dedup keys for perpDexs, allMids,
    // and metaAndAssetCtxs, so redundant API calls are avoided.
    const [tickerSnapshot, aggregatedMarkets] = yield* Effect.all(
      [provide(getTickerSnapshotEffect(info)), provide(getAggregatedMarketsSnapshot(info))],
      { concurrency: 2 }
    );

    // Update caches
    const now = Date.now();
    yield* Ref.set(tickerSlot, {
      value: tickerSnapshot,
      expiresAt: now + TICKER_SNAPSHOT_TTL_MS,
    });
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
        const rateLimiterSvc: RateLimiterService = { semaphore: innerSemaphore };
        const dedupSvc: DedupRegistryService = { registryRef: innerDedupRef };
        const provide = provideServicesFor(rateLimiterSvc, dedupSvc);

        const hlInfo = client.info as unknown as HyperliquidInfoClient;

        // ── Ref-based cache slots ───────────────────────────────────
        const tickerSlot = yield* Ref.make<CacheSlot<TickerSnapshot>>({
          expiresAt: 0,
        });
        const aggregatedSlot = yield* Ref.make<CacheSlot<readonly AggregatedTradeAsset[]>>({
          expiresAt: 0,
        });

        // ── Scoped helper: read with on-demand fallback ─────────────
        const readOrFetch = <T>(
          slot: Ref.Ref<CacheSlot<T>>,
          ttlMs: number,
          fetch: Effect.Effect<T, HyperliquidError>
        ): Effect.Effect<T, HyperliquidError> =>
          Effect.gen(function* () {
            const cached = yield* Ref.get(slot);
            const now = Date.now();
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

        // ── Daemon background refresh fiber ─────────────────────────
        const pipeline = makeRefreshPipeline(hlInfo, provide, tickerSlot, aggregatedSlot);

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
              const ticker = yield* readOrFetch(
                tickerSlot,
                TICKER_SNAPSHOT_TTL_MS,
                provide(getTickerSnapshotEffect(hlInfo))
              );
              const internalSymbol = resolveInternalSymbol(ticker, coin);

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
          getAllMids: () =>
            readOrFetch(
              tickerSlot,
              TICKER_SNAPSHOT_TTL_MS,
              provide(getTickerSnapshotEffect(hlInfo))
            ).pipe(Effect.map((s) => s.allMids)),

          // ── getAggregatedMarkets ──────────────────────────────
          getAggregatedMarkets: () =>
            readOrFetch(
              aggregatedSlot,
              AGGREGATED_MARKETS_TTL_MS,
              provide(getAggregatedMarketsSnapshot(hlInfo))
            ),

          // ── getTicker ─────────────────────────────────────────
          getTicker: (symbol) =>
            readOrFetch(
              tickerSlot,
              TICKER_SNAPSHOT_TTL_MS,
              provide(getTickerSnapshotEffect(hlInfo))
            ).pipe(Effect.map((s) => mapTickerFromSnapshot(s, symbol))),

          // ── getOrderBook ──────────────────────────────────────
          getOrderBook: (symbol, depth) =>
            Effect.gen(function* () {
              const ticker = yield* readOrFetch(
                tickerSlot,
                TICKER_SNAPSHOT_TTL_MS,
                provide(getTickerSnapshotEffect(hlInfo))
              );
              const internalSymbol = resolveInternalSymbol(ticker, symbol);

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
              const ticker = yield* readOrFetch(
                tickerSlot,
                TICKER_SNAPSHOT_TTL_MS,
                provide(getTickerSnapshotEffect(hlInfo))
              );
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
