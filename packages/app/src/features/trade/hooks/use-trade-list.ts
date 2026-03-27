/**
 * @overview Trade Asset Listing Hook
 *
 * Data flow: Hyperliquid API → React Query cache → TradeDropdown component
 *
 * Fetches all available perpetual markets from Hyperliquid:
 * 1. Calls perpDexs + perpCategories + allMids in parallel
 * 2. For each DEX, fetches metaAndAssetCtxs to get asset details
 * 3. Maps assets to TradeAsset with category, leverage, and pricing
 * 4. Sorts by open interest (highest first)
 *
 * Caching: 30s stale time, 5min gc time
 * Consumers: TradeDropdown (market selector)
 */
import { useQuery } from "@tanstack/react-query";
import { hyperliquidApi, type HyperliquidAssetCtx } from "@/services/hyperliquid";
import { queryKeys } from "@/lib/query/query-keys";

export type TradeCategory =
  | "crypto"
  | "stocks"
  | "commodities"
  | "fx"
  | "indices"
  | "preipo"
  | string;

export interface TradeAsset extends HyperliquidAssetCtx {
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

export function useTradeList() {
  return useQuery<TradeListData>({
    queryKey: queryKeys.hyperliquid.tradeList(),
    queryFn: async () => {
      const [perpDexs, perpCategories, allMids] = await Promise.all([
        hyperliquidApi.getPerpDexs(),
        hyperliquidApi.getPerpCategories(),
        hyperliquidApi.getAllMids(),
      ]);

      const categoryMap = new Map<string, string>();
      perpCategories.forEach(([coin, category]) => {
        categoryMap.set(coin.toUpperCase(), category);
      });

      const dexNames: string[] = [""];
      perpDexs.forEach((dex) => {
        if (dex) {
          dexNames.push(dex.name);
        }
      });

      const allAssets: TradeAsset[] = [];

      const metaPromises = dexNames.map((dexName) =>
        hyperliquidApi.getMetaAndAssetCtxs(dexName || undefined)
      );

      const metaResults = await Promise.all(metaPromises);

      let dexIndex = 0;
      for (const [meta, assetCtxs] of metaResults) {
        const universe = meta.universe;

        for (let i = 0; i < assetCtxs.length; i++) {
          const ctx = assetCtxs[i];
          const asset = universe[i];
          if (!asset) continue;

          const symbol = asset.name.toUpperCase();
          const category = categoryMap.get(symbol) || "crypto";
          const displayCategory = getDisplayCategory(category);

          if (asset.isDelisted) continue;

          const midPrice = allMids[symbol];
          const assetId = calculateAssetId(dexIndex, i);

          allAssets.push({
            coin: symbol,
            name: symbol,
            funding: ctx.funding,
            openInterest: ctx.openInterest,
            prevDayPx: ctx.prevDayPx,
            dayNtlVlm: ctx.dayNtlVlm,
            premium: ctx.premium ?? "",
            markPx: midPrice ?? ctx.markPx ?? "",
            maxLeverage: asset.maxLeverage || 10,
            category,
            displayCategory,
            dex: dexNames[dexIndex] || "HYPERLIQUID",
            assetId,
          });
        }
        dexIndex++;
      }

      allAssets.sort((a, b) => Number(b.openInterest) - Number(a.openInterest));

      return { assets: allAssets };
    },
    staleTime: 30_000,
    gcTime: 300_000,
  });
}
