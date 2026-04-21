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
  readonly metaAndAssetCtxs: () => Promise<[unknown, unknown]>;
  readonly allMids: () => Promise<Record<string, string>>;
  readonly perpCategories?: () => Promise<unknown>;
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

export const getTickerSnapshot = (info: HyperliquidInfoClient): Promise<TickerSnapshot> =>
  Promise.all([
    info.metaAndAssetCtxs(),
    info.allMids().catch(() => ({}) as Record<string, string>),
  ]).then(([[meta, assetCtxs], allMids]) => ({
    universe: Array.isArray((meta as { universe?: unknown })?.universe)
      ? ((meta as { universe: unknown[] }).universe as ReadonlyArray<MarketUniverseItem>)
      : [],
    assetCtxs: Array.isArray(assetCtxs) ? (assetCtxs as ReadonlyArray<MarketAssetCtxItem>) : [],
    allMids,
  }));

export const getMarketsSnapshot = (info: HyperliquidInfoClient): Promise<MarketsSnapshot> =>
  Promise.all([info.metaAndAssetCtxs(), info.allMids()]).then(
    async ([[meta, assetCtxs], allMids]) => {
      const universe = Array.isArray((meta as { universe?: unknown })?.universe)
        ? ((meta as { universe: unknown[] }).universe as ReadonlyArray<MarketUniverseItem>)
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

export const mapTickerFromSnapshot = (snapshot: TickerSnapshot, symbol: string): TickerPayload => {
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
