import { Effect } from "effect";
import { normalizeSymbol } from "./symbol";
import { HyperliquidError } from "./errors";
import type {
  MarketUniverseItem,
  MarketsSnapshot,
  MarketAssetCtxItem,
  TickerPayload,
  TickerSnapshot,
} from "./types";

type HyperliquidInfoClient = {
  readonly metaAndAssetCtxs: (params?: { dex?: string }) => Promise<[unknown, unknown]>;
  readonly allMids: () => Promise<Record<string, string>>;
  readonly perpCategories?: () => Promise<unknown>;
  readonly perpDexs?: () => Promise<any[]>;
};

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
  info: HyperliquidInfoClient,
  universe: ReadonlyArray<MarketUniverseItem>
): Promise<ReadonlyArray<readonly [string, string]>> => {
  const fallback = universe.map((asset) => [normalizeSymbol(asset.name), "crypto"] as const);
  if (typeof info.perpCategories !== "function") {
    return fallback;
  }

  try {
    const raw = await info.perpCategories();
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

const fetchBaseSnapshot = (info: HyperliquidInfoClient) =>
  Effect.all(
    [
      Effect.tryPromise({
        try: () => info.perpDexs?.() ?? Promise.resolve([]),
        catch: (cause) =>
          new HyperliquidError({ message: "Failed to fetch perp DEXs", kind: "UPSTREAM", cause }),
      }).pipe(Effect.catchAll(() => Effect.succeed([]))),
      Effect.tryPromise({
        try: () => info.allMids(),
        catch: (cause) =>
          new HyperliquidError({ message: "Failed to fetch mids", kind: "UPSTREAM", cause }),
      }).pipe(Effect.catchAll(() => Effect.succeed({} as Record<string, string>))),
    ],
    { concurrency: "unbounded" }
  );

const processMetaResults = (metaResults: [unknown, unknown][]) => {
  const flattenedUniverse: MarketUniverseItem[] = [];
  const flattenedAssetCtxs: MarketAssetCtxItem[] = [];

  metaResults.forEach((res, idx) => {
    if (!res || !Array.isArray(res)) return;
    const [meta, assetCtxs] = res;
    if (meta && typeof meta === "object" && "universe" in meta && Array.isArray(meta.universe)) {
      const universe = meta.universe as MarketUniverseItem[];
      flattenedUniverse.push(
        ...universe.map((item) => ({
          ...item,
          dexIndex: idx,
        }))
      );
    }
    if (Array.isArray(assetCtxs)) {
      flattenedAssetCtxs.push(...(assetCtxs as MarketAssetCtxItem[]));
    }
  });

  return { flattenedUniverse, flattenedAssetCtxs };
};

export const getTickerSnapshotEffect = (
  info: HyperliquidInfoClient
): Effect.Effect<TickerSnapshot, HyperliquidError> =>
  Effect.gen(function* () {
    const [perpDexs, allMids] = yield* fetchBaseSnapshot(info);

    const dexNames = [
      "",
      ...(perpDexs?.filter((d: any) => d !== null).map((d: any) => d.name) || []),
    ];

    const metaResults = yield* Effect.all(
      dexNames.map((dex) =>
        Effect.tryPromise({
          try: () => info.metaAndAssetCtxs(dex ? { dex } : undefined),
          catch: (cause) =>
            new HyperliquidError({
              message: `Failed to fetch meta for ${dex || "main"}`,
              kind: "UPSTREAM",
              cause,
            }),
        }).pipe(Effect.catchAll(() => Effect.succeed([null, null] as [unknown, unknown])))
      ),
      { concurrency: "unbounded" }
    );

    const { flattenedUniverse, flattenedAssetCtxs } = processMetaResults(
      metaResults as [unknown, unknown][]
    );

    return {
      universe: flattenedUniverse,
      assetCtxs: flattenedAssetCtxs,
      allMids,
    };
  });

export const getMarketsSnapshotEffect = (
  info: HyperliquidInfoClient
): Effect.Effect<MarketsSnapshot, HyperliquidError> =>
  Effect.gen(function* () {
    const snapshot = yield* getTickerSnapshotEffect(info);
    const categories = yield* Effect.tryPromise({
      try: () => getPerpCategories(info, snapshot.universe),
      catch: (cause) =>
        new HyperliquidError({ message: "Failed to fetch categories", kind: "UPSTREAM", cause }),
    });

    return {
      ...snapshot,
      perpCategories: categories,
    };
  });

export const mapTickerFromSnapshot = (snapshot: TickerSnapshot, symbol: string): TickerPayload => {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) {
    throw new HyperliquidError({
      message: "Symbol is required",
      kind: "BAD_REQUEST",
    });
  }

  // Check Perps
  let marketIndex = snapshot.universe.findIndex(
    (item) => normalizeSymbol(item.name) === normalizedSymbol || item.name === symbol
  );
  let ctx: MarketAssetCtxItem | undefined;

  if (marketIndex >= 0) {
    ctx = snapshot.assetCtxs[marketIndex];
  }

  const hasAllMidsSymbol =
    typeof snapshot.allMids[symbol] === "string" ||
    typeof snapshot.allMids[normalizedSymbol] === "string";

  if (!ctx && !hasAllMidsSymbol) {
    throw new HyperliquidError({
      message: `Symbol not found: ${symbol}`,
      kind: "NOT_FOUND",
    });
  }

  const fallbackMid = snapshot.allMids[symbol] ?? snapshot.allMids[normalizedSymbol];
  const mid =
    toNumberOrNull(ctx?.midPx) ?? toNumberOrNull(ctx?.markPx) ?? toNumberOrNull(fallbackMid);

  return {
    symbol: normalizedSymbol,
    mid,
    markPx: toNumberOrNull(ctx?.markPx) ?? mid,
    midPx: toNumberOrNull(ctx?.midPx) ?? mid,
    prevDayPx: toNumberOrNull(ctx?.prevDayPx),
    dayNtlVlm: toNumberOrNull(ctx?.dayNtlVlm),
    openInterest: toNumberOrNull(ctx?.openInterest) ?? 0,
    funding: toNumberOrNull(ctx?.funding) ?? 0,
  };
};

export const isPerpSymbol = (snapshot: TickerSnapshot, symbol: string): boolean => {
  const normalized = normalizeSymbol(symbol);
  return snapshot.universe.some(
    (u) => u.name === symbol || normalizeSymbol(u.name) === normalized || u.name === normalized
  );
};

export const resolveInternalSymbol = (snapshot: TickerSnapshot, symbol: string): string => {
  const normalized = normalizeSymbol(symbol);

  // 1. Check if it's already an internal perp name or builder perp
  const perp = snapshot.universe.find(
    (u) => u.name === symbol || normalizeSymbol(u.name) === normalized || u.name === normalized
  );
  if (perp) return perp.name;

  return normalized;
};
