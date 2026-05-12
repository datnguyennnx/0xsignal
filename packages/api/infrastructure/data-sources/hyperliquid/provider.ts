import { Context, Effect, Layer } from "effect";
import { normalizeCandles, parseHlRawCandles, toHlInterval } from "./normalizer";
import { normalizeSymbol } from "./symbol";
import { type Candle } from "../../../schemas/market-data";
import { HyperliquidClient } from "./client";
import type { MarketTimeframe } from "../../../domain/market-data/timeframe";
import type { PerpAnnotationResponse } from "@nktkas/hyperliquid/api/info";
import { HyperliquidError } from "./errors";
import { HyperliquidProvider } from "./types";
import type {
  TickerPayload,
  OrderBookPayload,
  TickerSnapshot,
  AggregatedTradeAsset,
} from "./types";
import {
  mapTickerFromSnapshot,
  getTickerSnapshotEffect,
  getAggregatedMarketsSnapshot,
  getSpotTokens,
  resolveInternalSymbol,
  isPerpSymbol,
} from "./mapping";
import { resolveWithCache, MARKET_SCHEMA_VERSION, type CacheSlot } from "./cache";

type HyperliquidClientService = Context.Tag.Service<typeof HyperliquidClient>;

export const getCandleSnapshot = (
  coin: string,
  interval: MarketTimeframe,
  startTime: number,
  endTime: number
): Effect.Effect<Candle[], HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const snapshot = yield* getTickerSnapshotEffect(info);
    const internalSymbol = resolveInternalSymbol(snapshot, coin);

    return yield* Effect.tryPromise({
      try: async () => {
        const candles = await info.candleSnapshot({
          coin: internalSymbol,
          interval: toHlInterval(interval),
          startTime,
          endTime,
        });
        return normalizeCandles(parseHlRawCandles(candles));
      },
      catch: (cause) =>
        new HyperliquidError({
          message: `Failed to fetch candles for ${coin} (${interval})`,
          cause,
        }),
    });
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
          cause,
        }),
    });
  });

export const getTicker = (
  symbol: string
): Effect.Effect<TickerPayload, HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const snapshot = yield* getTickerSnapshotEffect(info);
    return mapTickerFromSnapshot(snapshot, symbol);
  });

export const getOrderBook = (
  symbol: string,
  depth?: number
): Effect.Effect<OrderBookPayload, HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const snapshot = yield* getTickerSnapshotEffect(info);
    const internalSymbol = resolveInternalSymbol(snapshot, symbol);

    const parsedDepth = depth === undefined ? undefined : Math.trunc(depth);
    const nSigFigs: 2 | 3 | 4 | 5 | undefined =
      parsedDepth === 2 || parsedDepth === 3 || parsedDepth === 4 || parsedDepth === 5
        ? parsedDepth
        : undefined;

    return yield* Effect.tryPromise({
      try: async () => {
        const orderbook = await info.l2Book({
          coin: internalSymbol,
          nSigFigs,
        });
        if (!orderbook) {
          throw new HyperliquidError({
            message: `Orderbook not available for ${internalSymbol}`,
            kind: "NOT_FOUND",
          });
        }

        return {
          symbol: normalizeSymbol(symbol),
          nSigFigs,
          orderbook,
        };
      },
      catch: (cause) =>
        new HyperliquidError({
          message: `Failed to fetch orderbook for ${symbol}`,
          kind: "UPSTREAM",
          cause,
        }),
    });
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
    const snapshot = yield* getTickerSnapshotEffect(info);
    const internalSymbol = resolveInternalSymbol(snapshot, symbol);
    const isPerp = isPerpSymbol(snapshot, symbol);

    if (!isPerp) {
      throw new HyperliquidError({
        message: `Asset not supported or not found in perpetuals universe: ${symbol}`,
        kind: "NOT_FOUND",
      });
    }

    return yield* Effect.tryPromise({
      try: async () => {
        const annotation = await info.perpAnnotation({ coin: internalSymbol });
        return {
          symbol: normalizeSymbol(symbol),
          annotation,
        };
      },
      catch: (cause) =>
        new HyperliquidError({
          message: `Failed to fetch trade annotation for ${symbol}`,
          cause,
        }),
    });
  });

export const HyperliquidProviderLive = (client: HyperliquidClientService) => {
  // ── TTLs ─────────────────────────────────────────────────────────
  // Aggregated market list is cached with eager background refresh so
  // the cache is ALWAYS warm — users never wait for Hyperliquid API calls.
  // Sub-dependencies have longer TTLs (market list rarely changes).
  const AGGREGATED_MARKETS_TTL_MS = 60_000;
  const TICKER_SNAPSHOT_TTL_MS = 30_000;
  const CANDLE_SNAPSHOT_TTL_MS = 10_000;
  const TRADE_ANNOTATION_TTL_MS = 6 * 60 * 60 * 1000;
  const SPOT_META_TTL_MS = 120_000;
  const SPOT_META_AND_ASSET_CTXS_TTL_MS = 60_000;
  const OUTCOME_META_TTL_MS = 120_000;

  const aggregatedMarketsCache: CacheSlot<readonly AggregatedTradeAsset[]> = { expiresAt: 0 };
  const tickerSnapshotCache: CacheSlot<TickerSnapshot> = { expiresAt: 0 };
  const spotMetaCache: CacheSlot<string[]> = { expiresAt: 0 };
  const spotMetaAndAssetCtxsCache: CacheSlot<unknown> = { expiresAt: 0 };
  const outcomeMetaCache: CacheSlot<unknown> = { expiresAt: 0 };
  const candleSnapshotCache = new Map<string, CacheSlot<Candle[]>>();
  const tradeAnnotationCache = new Map<
    string,
    CacheSlot<{ symbol: string; annotation: PerpAnnotationResponse }>
  >();

  // ── Background refresh timers ───────────────────────────────────
  // Eager refresh keeps caches warm: after a successful fetch, the next
  // refresh fires at 80% of TTL so the cache NEVER expires under load.
  let aggregatedRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let tickerRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  // Used by closure timers below — declare to satisfy noUnusedLocals
  void aggregatedRefreshTimer;
  void tickerRefreshTimer;

  const loadAggregatedMarkets = async (): Promise<readonly AggregatedTradeAsset[]> => {
    const [tokens, spotRaw, outcomeRaw] = await Promise.all([
      getCachedSpotTokens(),
      getCachedSpotMetaAndAssetCtxs(),
      getCachedOutcomeMeta(),
    ]);
    const result = await Effect.runPromise(
      getAggregatedMarketsSnapshot(client.info, {
        spotTokens: tokens,
        spotMetaAndAssetCtxs: spotRaw,
        outcomeMeta: outcomeRaw,
      })
    );
    // Schedule next refresh before cache expires
    aggregatedRefreshTimer = setTimeout(() => {
      loadAggregatedMarkets().catch((err) => {
        console.error("[Hyperliquid] Aggregated refresh failed, retrying in 30s", err);
        aggregatedRefreshTimer = setTimeout(loadAggregatedMarkets, 30_000);
      });
    }, AGGREGATED_MARKETS_TTL_MS * 0.8);
    return result;
  };

  const loadTickerSnapshot = async (): Promise<TickerSnapshot> => {
    const result = await Effect.runPromise(getTickerSnapshotEffect(client.info));
    tickerRefreshTimer = setTimeout(() => {
      loadTickerSnapshot().catch((err) => {
        console.error("[Hyperliquid] Ticker refresh failed, retrying in 30s", err);
        tickerRefreshTimer = setTimeout(loadTickerSnapshot, 30_000);
      });
    }, TICKER_SNAPSHOT_TTL_MS * 0.8);
    return result;
  };

  // ── Cached sub-loaders ───────────────────────────────────────────
  const getCachedTickerSnapshot = () =>
    resolveWithCache(tickerSnapshotCache, TICKER_SNAPSHOT_TTL_MS, loadTickerSnapshot);

  const getCachedSpotTokens = () =>
    resolveWithCache(spotMetaCache, SPOT_META_TTL_MS, () =>
      Effect.runPromise(getSpotTokens(client.info))
    );

  const getCachedSpotMetaAndAssetCtxs = () =>
    resolveWithCache(spotMetaAndAssetCtxsCache, SPOT_META_AND_ASSET_CTXS_TTL_MS, () => {
      if (typeof client.info.spotMetaAndAssetCtxs !== "function") return Promise.resolve(null);
      return client.info.spotMetaAndAssetCtxs() as Promise<unknown>;
    });

  const getCachedOutcomeMeta = () =>
    resolveWithCache(outcomeMetaCache, OUTCOME_META_TTL_MS, () => {
      if (typeof client.info.outcomeMeta !== "function") return Promise.resolve(null);
      return client.info.outcomeMeta() as Promise<unknown>;
    });

  const getCachedCandleSnapshot = (
    symbol: string,
    interval: MarketTimeframe,
    startTime: number,
    endTime: number
  ) => {
    const cacheKey = `${symbol}|${interval}|${startTime}|${endTime}`;
    const slot = candleSnapshotCache.get(cacheKey) ?? { expiresAt: 0 };
    candleSnapshotCache.set(cacheKey, slot);

    return resolveWithCache(slot, CANDLE_SNAPSHOT_TTL_MS, async () => {
      const snapshot = await getCachedTickerSnapshot();
      const internalSymbol = resolveInternalSymbol(snapshot, symbol);
      const candles = await client.info.candleSnapshot({
        coin: internalSymbol,
        interval: toHlInterval(interval),
        startTime,
        endTime,
      });
      return normalizeCandles(parseHlRawCandles(candles));
    });
  };

  const getCachedTradeAnnotation = (symbol: string) => {
    const slot = tradeAnnotationCache.get(symbol) ?? { expiresAt: 0 };
    tradeAnnotationCache.set(symbol, slot);

    return resolveWithCache(slot, TRADE_ANNOTATION_TTL_MS, async () => {
      const snapshot = await getCachedTickerSnapshot();
      const internalSymbol = resolveInternalSymbol(snapshot, symbol);
      const isPerp = isPerpSymbol(snapshot, symbol);
      if (!isPerp) {
        throw new HyperliquidError({
          message: `Asset not found in perpetuals universe: ${symbol}`,
          kind: "NOT_FOUND",
        });
      }
      const annotation = await client.info.perpAnnotation({ coin: internalSymbol });
      return { symbol: normalizeSymbol(symbol), annotation };
    });
  };

  return HyperliquidProvider.of({
    getCandleSnapshot: (coin, interval, start, end) =>
      Effect.tryPromise({
        try: () => getCachedCandleSnapshot(coin, interval, start, end),
        catch: (cause) =>
          cause instanceof HyperliquidError
            ? cause
            : new HyperliquidError({
                message: `Failed to fetch candles for ${coin} (${interval})`,
                kind: "UPSTREAM",
                cause,
              }),
      }),
    getAllMids: () => getAllMids().pipe(Effect.provideService(HyperliquidClient, client)),
    getAggregatedMarkets: () =>
      Effect.tryPromise({
        // resolveWithCache is a Promise bridge — cleaner than nesting
        // Effect.runPromise inside an async tryPromise callback.
        try: () =>
          resolveWithCache(
            aggregatedMarketsCache,
            AGGREGATED_MARKETS_TTL_MS,
            loadAggregatedMarkets,
            MARKET_SCHEMA_VERSION
          ),
        catch: (cause) =>
          cause instanceof HyperliquidError
            ? cause
            : new HyperliquidError({
                message: "Failed to fetch aggregated markets",
                kind: "UPSTREAM",
                cause,
              }),
      }),
    getTicker: (symbol) =>
      Effect.tryPromise({
        try: async () => {
          const snapshot = await getCachedTickerSnapshot();
          return mapTickerFromSnapshot(snapshot, symbol);
        },
        catch: (cause) =>
          cause instanceof HyperliquidError
            ? cause
            : new HyperliquidError({
                message: `Failed to fetch ticker for ${symbol}`,
                kind: "UPSTREAM",
                cause,
              }),
      }),
    getOrderBook: (symbol, depth) =>
      getOrderBook(symbol, depth).pipe(Effect.provideService(HyperliquidClient, client)),
    getTradeAnnotation: (symbol) =>
      Effect.tryPromise({
        try: () => getCachedTradeAnnotation(symbol),
        catch: (cause) =>
          cause instanceof HyperliquidError
            ? cause
            : new HyperliquidError({
                message: `Failed to fetch trade annotation for ${symbol}`,
                kind: "UPSTREAM",
                cause,
              }),
      }),
  });
};

export const HyperliquidProviderLayer = Layer.effect(
  HyperliquidProvider,
  Effect.gen(function* () {
    const client = yield* HyperliquidClient;
    return HyperliquidProviderLive(client);
  })
);
