/// <reference lib="es2023.array" />
import { asRecord, isUnknownArray, numberAt, stringAt } from "../parse-utils";
import type {
  HyperliquidAggregatedAsset,
  MarketAssetCtxItem,
  MarketUniverseItem,
  PerpTradeAsset,
  SpotTradeAsset,
} from "./types";

export { mapTickerFromSnapshot, resolveInternalSymbol } from "./ticker-snapshot";

export { parsePerpAssets } from "./perp-parser";
export { parseSpotAssets } from "./spot-parser";

const MARKET_TYPE_ORDER: Record<string, number> = { perp: 0, spot: 1 };

export function extractSpotTokens(raw: unknown): string[] {
  const resp = asRecord(raw);
  if (resp === null || !isUnknownArray(resp.tokens)) return [];
  return resp.tokens.map((token) => stringAt(asRecord(token) ?? {}, "name") ?? "");
}

const toUniverseItem = (entry: Record<string, unknown>): MarketUniverseItem => ({
  name: stringAt(entry, "name") ?? "",
  szDecimals: numberAt(entry, "szDecimals"),
  maxLeverage: numberAt(entry, "maxLeverage"),
  isDelisted: entry.isDelisted === true ? true : undefined,
});

const toAssetCtx = (entry: Record<string, unknown>): MarketAssetCtxItem => ({
  prevDayPx: stringAt(entry, "prevDayPx"),
  dayNtlVlm: stringAt(entry, "dayNtlVlm"),
  markPx: stringAt(entry, "markPx"),
  midPx: stringAt(entry, "midPx") ?? null,
  funding: stringAt(entry, "funding"),
  openInterest: stringAt(entry, "openInterest"),
  premium: stringAt(entry, "premium") ?? null,
});

export const processMetaResults = (metaResults: [unknown, unknown][]) => {
  const flattenedUniverse: MarketUniverseItem[] = [];
  const flattenedAssetCtxs: MarketAssetCtxItem[] = [];
  metaResults.forEach((result, idx) => {
    const meta = asRecord(result[0]);
    if (meta !== null && isUnknownArray(meta.universe)) {
      // Entries are kept index-aligned with `assetCtxs`; an unparsable entry
      // becomes an empty record rather than shifting the pairing.
      for (const entry of meta.universe) {
        flattenedUniverse.push({ ...toUniverseItem(asRecord(entry) ?? {}), dexIndex: idx });
      }
    }
    if (isUnknownArray(result[1])) {
      for (const entry of result[1]) {
        flattenedAssetCtxs.push(toAssetCtx(asRecord(entry) ?? {}));
      }
    }
  });
  return { flattenedUniverse, flattenedAssetCtxs };
};

export function sortAndDedupeAssets(
  perpAssets: PerpTradeAsset[],
  spotAssets: SpotTradeAsset[],
): HyperliquidAggregatedAsset[] {
  const combined: HyperliquidAggregatedAsset[] = [...perpAssets, ...spotAssets];
  const sorted = combined.toSorted((a, b) => {
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
