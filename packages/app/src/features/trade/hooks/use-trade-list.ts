/**
 * @overview Trade Asset Listing Hook
 *
 * Data flow: Backend API → React Query cache → TradeDropdown component
 *
 * Fetches all available perpetual markets from backend /api/markets.
 * The payload can include either a simple universe array or richer metadata.
 * The hook normalizes both shapes while preserving prior UI sort/display behavior.
 *
 * Caching: 30s stale time, 5min gc time
 * Consumers: TradeDropdown (market selector)
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import { normalizeSymbol } from "../lib/symbol";

export type TradeCategory =
  | "crypto"
  | "stocks"
  | "commodities"
  | "fx"
  | "indices"
  | "preipo"
  | string;

interface TradeAssetCtxLike {
  funding?: string;
  openInterest?: string;
  prevDayPx?: string;
  dayNtlVlm?: string;
  premium?: string;
  markPx?: string;
}

interface TradeAssetUniverseLike {
  name?: string;
  maxLeverage?: number;
  isDelisted?: boolean;
}

interface BackendMarketsPayload {
  universe?: TradeAssetUniverseLike[];
  assetCtxs?: TradeAssetCtxLike[];
  allMids?: Record<string, string>;
  perpCategories?: Array<[string, string]>;
}

export interface TradeAsset extends Required<TradeAssetCtxLike> {
  coin: string;
  maxLeverage: number;
  category: TradeCategory;
  displayCategory: string;
  name: string;
  dex: string;
  assetId: number;
}

export interface TradeListData {
  assets: TradeAsset[];
}

function calculateAssetId(dexIndex: number, assetIndex: number): number {
  if (dexIndex === 0) {
    return assetIndex;
  }
  return 100000 + dexIndex * 10000 + assetIndex;
}

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  crypto: "Crypto",
  stocks: "Stocks",
  commodities: "Commodities",
  fx: "Forex",
  indices: "Indices",
  preipo: "Pre-IPO",
};

function getDisplayCategory(category: string): string {
  return CATEGORY_DISPLAY_NAMES[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

function toTradeAssets(payload: BackendMarketsPayload): TradeAsset[] {
  const universe = Array.isArray(payload.universe) ? payload.universe : [];
  const assetCtxs = Array.isArray(payload.assetCtxs) ? payload.assetCtxs : [];
  const allMids = payload.allMids ?? {};

  const categoryMap = new Map<string, string>();
  for (const [coin, category] of payload.perpCategories ?? []) {
    categoryMap.set(normalizeSymbol(coin), category);
  }

  const assets: TradeAsset[] = [];

  for (let i = 0; i < universe.length; i++) {
    const market = universe[i];
    const rawName = market?.name;
    if (!rawName || market?.isDelisted) continue;

    const normalized = normalizeSymbol(rawName);
    const ctx = assetCtxs[i] ?? {};
    const category = categoryMap.get(normalized) ?? "crypto";

    assets.push({
      coin: normalized,
      name: normalized,
      funding: ctx.funding ?? "0",
      openInterest: ctx.openInterest ?? "0",
      prevDayPx: ctx.prevDayPx ?? "0",
      dayNtlVlm: ctx.dayNtlVlm ?? "0",
      premium: ctx.premium ?? "",
      markPx: allMids[normalized] ?? ctx.markPx ?? "0",
      maxLeverage: market.maxLeverage || 10,
      category,
      displayCategory: getDisplayCategory(category),
      dex: "HYPERLIQUID",
      assetId: calculateAssetId(0, i),
    });
  }

  assets.sort((a, b) => Number(b.openInterest) - Number(a.openInterest));
  return assets;
}

export function useTradeList() {
  return useQuery<BackendMarketsPayload, Error, TradeListData>({
    queryKey: queryKeys.marketData.markets(),
    queryFn: async () => (await api.getMarkets()) as BackendMarketsPayload,
    select: (payload) => ({ assets: toTradeAssets(payload) }),
    staleTime: 30_000,
    gcTime: 300_000,
  });
}
