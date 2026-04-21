import { Context, Effect, Layer } from "effect";
import { normalizeCandles, parseHlRawCandles, toHlInterval } from "./normalizer";
import { normalizeSymbol } from "./symbol";
import { type Candle } from "../../../schemas/market-data";
import { HyperliquidClient } from "./client";
import type { MarketTimeframe } from "../../../domain/market-data/timeframe";
import type { PerpAnnotationResponse } from "@nktkas/hyperliquid/api/info";
import { HyperliquidError } from "./errors";
import { HyperliquidProvider } from "./types";
import type { MarketsSnapshot, TickerPayload, OrderBookPayload, TickerSnapshot } from "./types";
import { mapTickerFromSnapshot, getMarketsSnapshot, getTickerSnapshot } from "./mapping";
import { resolveWithCache, type CacheSlot } from "./cache";

type HyperliquidClientService = Context.Tag.Service<typeof HyperliquidClient>;

export const getCandleSnapshot = (
  coin: string,
  interval: MarketTimeframe,
  startTime: number,
  endTime: number
): Effect.Effect<Candle[], HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;

    return yield* Effect.tryPromise({
      try: async () => {
        const candles = await info.candleSnapshot({
          coin,
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

export const getMetadata = (): Effect.Effect<
  MarketsSnapshot,
  HyperliquidError,
  HyperliquidClient
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    return yield* Effect.tryPromise({
      try: () => getMarketsSnapshot(info),
      catch: (cause) =>
        cause instanceof HyperliquidError
          ? cause
          : new HyperliquidError({
              message: "Failed to fetch Hyperliquid metadata",
              kind: "UPSTREAM",
              cause,
            }),
    });
  });

export const getTicker = (
  symbol: string
): Effect.Effect<TickerPayload, HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    return yield* Effect.tryPromise({
      try: async () => {
        const normalizedSymbol = normalizeSymbol(symbol);
        if (!normalizedSymbol) {
          throw new HyperliquidError({
            message: "Symbol is required",
            kind: "BAD_REQUEST",
          });
        }

        const snapshot = await getTickerSnapshot(info);
        return mapTickerFromSnapshot(snapshot, normalizedSymbol);
      },
      catch: (cause) =>
        cause instanceof HyperliquidError
          ? cause
          : new HyperliquidError({
              message: `Failed to fetch ticker for ${symbol}`,
              kind: "UPSTREAM",
              cause,
            }),
    });
  });

export const getOrderBook = (
  symbol: string,
  depth?: number
): Effect.Effect<OrderBookPayload, HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    return yield* Effect.tryPromise({
      try: async () => {
        const normalizedSymbol = normalizeSymbol(symbol);
        const parsedDepth = depth === undefined ? undefined : Math.trunc(depth);
        const nSigFigs: 2 | 3 | 4 | 5 | undefined =
          parsedDepth === 2 || parsedDepth === 3 || parsedDepth === 4 || parsedDepth === 5
            ? parsedDepth
            : undefined;

        const orderbook = await info.l2Book({
          coin: normalizedSymbol,
          nSigFigs,
        });
        if (!orderbook) {
          throw new HyperliquidError({
            message: `Orderbook not available for ${normalizedSymbol}`,
            kind: "NOT_FOUND",
          });
        }

        return {
          symbol: normalizedSymbol,
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
    return yield* Effect.tryPromise({
      try: async () => {
        const normalizedSymbol = normalizeSymbol(symbol);
        const annotation = await info.perpAnnotation({ coin: normalizedSymbol });
        return {
          symbol: normalizedSymbol,
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
  const MARKETS_TTL_MS = 15_000;
  const TICKER_SNAPSHOT_TTL_MS = 1_000;
  const CANDLE_SNAPSHOT_TTL_MS = 1_000;
  const TRADE_ANNOTATION_TTL_MS = 6 * 60 * 60 * 1000;

  const metadataCache: CacheSlot<MarketsSnapshot> = { expiresAt: 0 };
  const tickerSnapshotCache: CacheSlot<TickerSnapshot> = { expiresAt: 0 };
  const candleSnapshotCache = new Map<string, CacheSlot<Candle[]>>();
  const tradeAnnotationCache = new Map<
    string,
    CacheSlot<{ symbol: string; annotation: PerpAnnotationResponse }>
  >();

  const getCachedMarkets = () =>
    resolveWithCache(metadataCache, MARKETS_TTL_MS, () => getMarketsSnapshot(client.info));
  const getCachedTickerSnapshot = () =>
    resolveWithCache(tickerSnapshotCache, TICKER_SNAPSHOT_TTL_MS, () =>
      getTickerSnapshot(client.info)
    );

  const getCachedCandleSnapshot = (
    coin: string,
    interval: MarketTimeframe,
    startTime: number,
    endTime: number
  ) => {
    const cacheKey = `${coin}|${interval}|${startTime}|${endTime}`;
    const slot = candleSnapshotCache.get(cacheKey) ?? { expiresAt: 0 };
    candleSnapshotCache.set(cacheKey, slot);

    return resolveWithCache(slot, CANDLE_SNAPSHOT_TTL_MS, async () => {
      const candles = await client.info.candleSnapshot({
        coin,
        interval: toHlInterval(interval),
        startTime,
        endTime,
      });

      return normalizeCandles(parseHlRawCandles(candles));
    });
  };

  const getCachedTradeAnnotation = (symbol: string) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    const slot = tradeAnnotationCache.get(normalizedSymbol) ?? { expiresAt: 0 };
    tradeAnnotationCache.set(normalizedSymbol, slot);

    return resolveWithCache(slot, TRADE_ANNOTATION_TTL_MS, async () => {
      const annotation = await client.info.perpAnnotation({ coin: normalizedSymbol });
      return {
        symbol: normalizedSymbol,
        annotation,
      };
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
    getMetadata: () =>
      Effect.tryPromise({
        try: () => getCachedMarkets(),
        catch: (cause) =>
          cause instanceof HyperliquidError
            ? cause
            : new HyperliquidError({
                message: "Failed to fetch Hyperliquid metadata",
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
