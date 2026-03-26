/**
 * @overview Perpetual Listing Hook
 *
 * Fetches the complete list of available perpetual assets from Hyperliquid.
 * Includes HIP-1 (default perp) and HIP-3 (builder-deployed) perpetual markets.
 *
 * @mechanism
 * - Uses perpDexs to get all DEX names
 * - Uses perpCategories API to get category mapping (NOT hardcoded)
 * - For each DEX, calls metaAndAssetCtxs with the dex parameter
 * - Maps asset IDs correctly: HIP-1 = index, HIP-3 = 100000 + dexIndex * 10000 + index
 *
 * @strategy 30s stale time to keep market listings reasonably fresh without over-fetching.
 */
import { useQuery } from "@tanstack/react-query";
import { hyperliquidApi, type HyperliquidAssetCtx } from "@/services/hyperliquid";
import { queryKeys } from "@/lib/query/query-keys";

export type PerpCategory =
  | "crypto"
  | "stocks"
  | "commodities"
  | "fx"
  | "indices"
  | "preipo"
  | string;

export interface PerpAsset extends HyperliquidAssetCtx {
  maxLeverage: number;
  category: PerpCategory;
  displayCategory: string;
  name: string;
  dex: string;
  assetId: number;
}

export interface PerpListData {
  assets: PerpAsset[];
}

function calculatePerpAssetId(dexIndex: number, assetIndex: number): number {
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

export function usePerpList() {
  return useQuery<PerpListData>({
    queryKey: queryKeys.hyperliquid.perpList(),
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

      const allAssets: PerpAsset[] = [];

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
          const assetId = calculatePerpAssetId(dexIndex, i);

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
