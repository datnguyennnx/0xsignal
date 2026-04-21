import { Effect, Context, Data, Layer } from "effect";
import { normalizeCandles, toHlInterval } from "./normalizer";
import { normalizeSymbol } from "./symbol";
import { type Candle } from "@schemas/market-data";
import { HyperliquidClient } from "./client";
import type { Timeframe } from "../../db/questdb/queries/candle";
import type { L2BookResponse, PerpAnnotationResponse } from "@nktkas/hyperliquid/api/info";

type MarketUniverseItem = {
  readonly name: string;
  readonly szDecimals?: number;
  readonly maxLeverage?: number;
  readonly isDelisted?: boolean;
};

type MarketAssetCtxItem = {
  readonly prevDayPx?: string;
  readonly dayNtlVlm?: string;
  readonly markPx?: string;
  readonly midPx?: string | null;
  readonly funding?: string;
  readonly openInterest?: string;
  readonly premium?: string | null;
};

type MarketsSnapshot = {
  readonly universe: ReadonlyArray<MarketUniverseItem>;
  readonly assetCtxs: ReadonlyArray<MarketAssetCtxItem>;
  readonly allMids: Readonly<Record<string, string>>;
  readonly perpCategories: ReadonlyArray<readonly [string, string]>;
};

type TickerPayload = {
  readonly symbol: string;
  readonly mid: number | null;
  readonly markPx: number | null;
  readonly midPx: number | null;
  readonly prevDayPx: number | null;
  readonly dayNtlVlm: number | null;
  readonly openInterest: number | null;
  readonly funding: number | null;
};

type OrderBookPayload = {
  readonly symbol: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
  readonly orderbook: L2BookResponse;
};

type TickerSnapshot = Pick<MarketsSnapshot, "universe" | "assetCtxs" | "allMids">;

export class HyperliquidError extends Data.TaggedError("HyperliquidError")<{
  readonly message: string;
  readonly kind?: "BAD_REQUEST" | "NOT_FOUND" | "UPSTREAM";
  readonly cause?: unknown;
}> {}

export class HyperliquidProvider extends Context.Tag("HyperliquidProvider")<
  HyperliquidProvider,
  {
    readonly getCandleSnapshot: (
      coin: string,
      interval: Timeframe,
      startTime: number,
      endTime: number
    ) => Effect.Effect<Candle[], HyperliquidError>;
    readonly getAllMids: () => Effect.Effect<Record<string, string>, HyperliquidError>;
    readonly getMetadata: () => Effect.Effect<MarketsSnapshot, HyperliquidError>;
    readonly getTicker: (symbol: string) => Effect.Effect<TickerPayload, HyperliquidError>;
    readonly getOrderBook: (
      symbol: string,
      depth?: number
    ) => Effect.Effect<OrderBookPayload, HyperliquidError>;
    readonly getTradeAnnotation: (
      symbol: string
    ) => Effect.Effect<{ symbol: string; annotation: PerpAnnotationResponse }, HyperliquidError>;
  }
>() {}

type HyperliquidClientService = Context.Tag.Service<typeof HyperliquidClient>;

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toPerpCategoryPairs = (raw: unknown): ReadonlyArray<readonly [string, string]> => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const pairs: Array<readonly [string, string]> = [];

  for (const item of raw) {
    if (
      Array.isArray(item) &&
      item.length >= 2 &&
      typeof item[0] === "string" &&
      typeof item[1] === "string"
    ) {
      pairs.push([normalizeSymbol(item[0]), item[1]]);
      continue;
    }

    if (typeof item === "object" && item !== null) {
      const value = item as {
        coin?: unknown;
        symbol?: unknown;
        name?: unknown;
        category?: unknown;
      };
      const coin =
        typeof value.coin === "string"
          ? value.coin
          : typeof value.symbol === "string"
            ? value.symbol
            : typeof value.name === "string"
              ? value.name
              : undefined;

      if (coin && typeof value.category === "string") {
        pairs.push([normalizeSymbol(coin), value.category]);
      }
    }
  }

  return pairs;
};

const getPerpCategories = async (
  info: HyperliquidClientService["info"],
  universe: ReadonlyArray<MarketUniverseItem>
): Promise<ReadonlyArray<readonly [string, string]>> => {
  const fallback = universe.map((asset) => [normalizeSymbol(asset.name), "crypto"] as const);

  const client = info as HyperliquidClientService["info"] & {
    readonly perpCategories?: () => Promise<unknown>;
  };

  if (typeof client.perpCategories !== "function") {
    return fallback;
  }

  try {
    const raw = await client.perpCategories();
    const parsed = toPerpCategoryPairs(raw);
    if (parsed.length === 0) {
      return fallback;
    }

    const merged = new Map<string, string>(fallback);
    for (const [symbol, category] of parsed) {
      merged.set(symbol, category);
    }
    return Array.from(merged.entries()).map(([symbol, category]) => [symbol, category] as const);
  } catch {
    return fallback;
  }
};

const getTickerSnapshot = (info: HyperliquidClientService["info"]): Promise<TickerSnapshot> =>
  Promise.all([
    info.metaAndAssetCtxs(),
    info.allMids().catch(() => ({}) as Record<string, string>),
  ]).then(([[meta, assetCtxs], allMids]) => ({
    universe: Array.isArray(meta?.universe)
      ? (meta.universe as ReadonlyArray<MarketUniverseItem>)
      : [],
    assetCtxs: Array.isArray(assetCtxs) ? (assetCtxs as ReadonlyArray<MarketAssetCtxItem>) : [],
    allMids,
  }));

const getMarketsSnapshot = (info: HyperliquidClientService["info"]): Promise<MarketsSnapshot> =>
  Promise.all([info.metaAndAssetCtxs(), info.allMids()]).then(
    async ([[meta, assetCtxs], allMids]) => {
      const universe = Array.isArray(meta?.universe)
        ? (meta.universe as ReadonlyArray<MarketUniverseItem>)
        : [];

      const categories = await getPerpCategories(info, universe);

      return {
        universe,
        assetCtxs: Array.isArray(assetCtxs) ? (assetCtxs as ReadonlyArray<MarketAssetCtxItem>) : [],
        allMids,
        perpCategories: categories,
      };
    }
  );

const mapTickerFromSnapshot = (snapshot: TickerSnapshot, symbol: string): TickerPayload => {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) {
    throw new HyperliquidError({
      message: "Symbol is required",
      kind: "BAD_REQUEST",
    });
  }

  const marketIndex = snapshot.universe.findIndex(
    (item) => normalizeSymbol(item.name) === normalizedSymbol
  );
  const hasAllMidsSymbol = typeof snapshot.allMids[normalizedSymbol] === "string";

  if (marketIndex < 0 && !hasAllMidsSymbol) {
    throw new HyperliquidError({
      message: `Symbol not found: ${normalizedSymbol}`,
      kind: "NOT_FOUND",
    });
  }

  const ctx = marketIndex >= 0 ? snapshot.assetCtxs[marketIndex] : undefined;
  const fallbackMid = snapshot.allMids[normalizedSymbol];
  const mid =
    toNumberOrNull(ctx?.midPx) ?? toNumberOrNull(ctx?.markPx) ?? toNumberOrNull(fallbackMid);

  return {
    symbol: normalizedSymbol,
    mid,
    markPx: toNumberOrNull(ctx?.markPx) ?? mid,
    midPx: toNumberOrNull(ctx?.midPx) ?? mid,
    prevDayPx: toNumberOrNull(ctx?.prevDayPx),
    dayNtlVlm: toNumberOrNull(ctx?.dayNtlVlm),
    openInterest: toNumberOrNull(ctx?.openInterest),
    funding: toNumberOrNull(ctx?.funding),
  };
};

export const getCandleSnapshot = (
  coin: string,
  interval: Timeframe,
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
        return normalizeCandles(candles);
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

  type CacheSlot<T> = {
    value?: T;
    expiresAt: number;
    inFlight?: Promise<T>;
  };

  const metadataCache: CacheSlot<MarketsSnapshot> = { expiresAt: 0 };
  const tickerSnapshotCache: CacheSlot<TickerSnapshot> = { expiresAt: 0 };
  const candleSnapshotCache = new Map<string, CacheSlot<Candle[]>>();
  const tradeAnnotationCache = new Map<
    string,
    CacheSlot<{ symbol: string; annotation: PerpAnnotationResponse }>
  >();

  const resolveWithCache = <T>(slot: CacheSlot<T>, ttlMs: number, loader: () => Promise<T>) => {
    const now = Date.now();
    if (slot.value !== undefined && slot.expiresAt > now) {
      return Promise.resolve(slot.value);
    }
    if (slot.inFlight) {
      return slot.inFlight;
    }

    const request = loader()
      .then((value) => {
        slot.value = value;
        slot.expiresAt = Date.now() + ttlMs;
        return value;
      })
      .finally(() => {
        slot.inFlight = undefined;
      });

    slot.inFlight = request;
    return request;
  };

  const getCachedMarkets = () =>
    resolveWithCache(metadataCache, MARKETS_TTL_MS, () => getMarketsSnapshot(client.info));
  const getCachedTickerSnapshot = () =>
    resolveWithCache(tickerSnapshotCache, TICKER_SNAPSHOT_TTL_MS, () =>
      getTickerSnapshot(client.info)
    );

  const getCachedCandleSnapshot = (
    coin: string,
    interval: Timeframe,
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

      return normalizeCandles(candles);
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
