import { useQuery } from "@tanstack/react-query";
import {
  hyperliquidApi,
  type HyperliquidAssetCtx,
  type HyperliquidMeta,
} from "@/services/hyperliquid";

export interface FuturesAsset extends HyperliquidAssetCtx {
  maxLeverage: number;
  category: string;
  name: string;
}

function extractSymbol(fullName: string): string {
  const colonIndex = fullName.indexOf(":");
  return colonIndex !== -1 ? fullName.slice(colonIndex + 1) : fullName;
}

export function useFuturesList() {
  return useQuery({
    queryKey: ["hyperliquid-futures"],
    queryFn: async () => {
      const [rawMetaData, categories] = await Promise.all([
        hyperliquidApi.getMetaAndAssetCtxs(),
        hyperliquidApi.getPerpCategories(),
      ]);

      const metaData = rawMetaData as
        | { meta: HyperliquidMeta; assetCtxs: HyperliquidAssetCtx[] }
        | [HyperliquidMeta, HyperliquidAssetCtx[]];

      const meta = Array.isArray(metaData) ? metaData[0] : metaData.meta;
      const assetCtxs = Array.isArray(metaData) ? metaData[1] : metaData.assetCtxs;

      const categoryMap = new Map<string, string>();
      const categoryEntries = Object.values(categories) as [string, string][];
      for (const [fullName, category] of categoryEntries) {
        const symbol = extractSymbol(fullName).toUpperCase();
        if (!categoryMap.has(symbol)) {
          categoryMap.set(symbol, category);
        }
      }

      const delistedSet = new Set<string>();
      const symbolToMaxLeverage = new Map<string, number>();
      for (const asset of meta.universe) {
        const symbol = asset.name.toUpperCase();
        symbolToMaxLeverage.set(symbol, asset.maxLeverage);
        if (asset.isDelisted) {
          delistedSet.add(symbol);
        }
      }

      const universe = meta.universe;

      const filtered = assetCtxs
        .map((ctx, index) => {
          const asset = universe[index];
          const symbol = asset?.name?.toUpperCase() || "";
          return {
            ...ctx,
            coin: symbol,
            name: symbol,
            maxLeverage: asset?.maxLeverage || 10,
            category: categoryMap.get(symbol) || (symbol.includes(":") ? "perp" : "crypto"),
          };
        })
        .filter((item) => {
          if (!item.coin) return false;
          return Number(item.openInterest) > 0 && !delistedSet.has(item.coin);
        })
        .sort((a, b) => Number(b.openInterest) - Number(a.openInterest));

      return filtered;
    },
    staleTime: 30_000,
    gcTime: 300_000,
  });
}

export const CATEGORIES = [
  { id: "all", label: "All", color: "bg-muted" },
  { id: "crypto", label: "Crypto", color: "bg-blue-500/20 text-blue-400" },
  { id: "stocks", label: "Stocks", color: "bg-green-500/20 text-green-400" },
  { id: "indices", label: "Indices", color: "bg-purple-500/20 text-purple-400" },
  { id: "commodities", label: "Commodities", color: "bg-yellow-500/20 text-yellow-400" },
  { id: "fx", label: "Forex", color: "bg-orange-500/20 text-orange-400" },
  { id: "preipo", label: "Pre-IPO", color: "bg-pink-500/20 text-pink-400" },
];
