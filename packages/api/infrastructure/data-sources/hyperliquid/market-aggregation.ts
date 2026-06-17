import type {
  HyperliquidAggregatedAsset,
  MarketAssetCtxItem,
  MarketUniverseItem,
  PerpTradeAsset,
  SpotTradeAsset,
} from "./types";

export { mapTickerFromSnapshot, isPerpSymbol, resolveInternalSymbol } from "./ticker-snapshot";

export { parsePerpAssets } from "./perp-parser";
export { parseSpotAssets } from "./spot-parser";

const MARKET_TYPE_ORDER: Record<string, number> = { perp: 0, spot: 1 };

export function extractSpotTokens(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const resp = raw as { tokens?: Array<{ name?: unknown; index?: unknown }> };
  if (!Array.isArray(resp.tokens)) return [];
  return resp.tokens.map((t) => (typeof t.name === "string" ? t.name : ""));
}

export const processMetaResults = (metaResults: [unknown, unknown][]) => {
  const flattenedUniverse: MarketUniverseItem[] = [];
  const flattenedAssetCtxs: MarketAssetCtxItem[] = [];
  metaResults.forEach((res, idx) => {
    if (!res || !Array.isArray(res)) return;
    const [meta, assetCtxs] = res;
    if (meta && typeof meta === "object" && "universe" in meta && Array.isArray(meta.universe)) {
      const universe = meta.universe as MarketUniverseItem[];
      flattenedUniverse.push(...universe.map((item) => ({ ...item, dexIndex: idx })));
    }
    if (Array.isArray(assetCtxs)) {
      flattenedAssetCtxs.push(...(assetCtxs as MarketAssetCtxItem[]));
    }
  });
  return { flattenedUniverse, flattenedAssetCtxs };
};

export function sortAndDedupeAssets(
  perpAssets: PerpTradeAsset[],
  spotAssets: SpotTradeAsset[],
): HyperliquidAggregatedAsset[] {
  const combined: HyperliquidAggregatedAsset[] = [...perpAssets, ...spotAssets];
  const sorted = [...combined].sort((a, b) => {
    if (a.isDelisted !== b.isDelisted) return a.isDelisted ? 1 : -1;
    const typeDiff =
      (MARKET_TYPE_ORDER[a.marketType] ?? 99) - (MARKET_TYPE_ORDER[b.marketType] ?? 99);
    if (typeDiff !== 0) return typeDiff;
    return Number(b.dayNtlVlm) - Number(a.dayNtlVlm);
  });
  const seen = new Map<string, HyperliquidAggregatedAsset>();
  for (const asset of sorted) {
    const key = `${asset.rawCoin}-${asset.marketType}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, asset);
    } else if (existing.dexPrefix !== null && asset.dexPrefix === null) {
      seen.set(key, asset);
    } else if (
      existing.dexPrefix !== null &&
      asset.dexPrefix !== null &&
      Number(asset.dayNtlVlm) > Number(existing.dayNtlVlm)
    ) {
      seen.set(key, asset);
    }
  }
  return Array.from(seen.values());
}
