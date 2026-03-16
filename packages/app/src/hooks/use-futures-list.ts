import { useQuery } from "@tanstack/react-query";
import { hyperliquidApi, type HyperliquidAssetCtx } from "@/services/hyperliquid";

export interface FuturesAsset extends HyperliquidAssetCtx {
  maxLeverage: number;
  category: string;
  name: string;
}

export interface FuturesListData {
  assets: FuturesAsset[];
}

export function useFuturesList() {
  return useQuery<FuturesListData>({
    queryKey: ["hyperliquid-futures"],
    queryFn: async () => {
      const [metaAndAssetCtxs, allMids] = await Promise.all([
        hyperliquidApi.getMetaAndAssetCtxs(""),
        hyperliquidApi.getAllMids(),
      ]);

      const [meta, assetCtxs] = metaAndAssetCtxs;
      const universe = meta.universe;

      const assets: FuturesAsset[] = [];

      for (let i = 0; i < assetCtxs.length; i++) {
        const ctx = assetCtxs[i];
        const asset = universe[i];
        if (!asset) continue;

        const symbol = asset.name.toUpperCase();

        if (Number(ctx.openInterest) <= 0) continue;
        if (asset.isDelisted) continue;

        const midPrice = allMids[symbol];

        assets.push({
          coin: symbol,
          name: symbol,
          funding: ctx.funding,
          openInterest: ctx.openInterest,
          prevDayPx: ctx.prevDayPx,
          dayNtlVlm: ctx.dayNtlVlm,
          premium: ctx.premium,
          markPx: midPrice || ctx.markPx,
          maxLeverage: asset.maxLeverage || 10,
          category: "crypto",
        });
      }

      assets.sort((a, b) => Number(b.openInterest) - Number(a.openInterest));

      return { assets };
    },
    staleTime: 30_000,
    gcTime: 300_000,
  });
}
