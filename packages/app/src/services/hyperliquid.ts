import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";

// Singleton pattern for stateless HTTP client - intentionally created once
const transport = new HttpTransport();
const infoClient = new InfoClient({ transport });

export interface HyperliquidAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  isDelisted?: boolean;
  marginTableId: number;
}

export interface HyperliquidAssetCtx {
  coin: string;
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  markPx: string;
}

export interface HyperliquidMeta {
  universe: HyperliquidAsset[];
}

export interface HyperliquidMetaAndAssetCtxs {
  meta: HyperliquidMeta;
  assetCtxs: HyperliquidAssetCtx[];
}

export type HyperliquidMetaAndAssetCtxsResponse = [HyperliquidMeta, HyperliquidAssetCtx[]];

export type PerpCategoriesResponse = [string, string][];

export type AllPerpMetasResponse = [HyperliquidMeta, HyperliquidAssetCtx[]][];

export const hyperliquidApi = {
  getMeta: () => infoClient.meta(),

  getMetaAndAssetCtxs: () => infoClient.metaAndAssetCtxs(),

  getPerpCategories: () => infoClient.perpCategories(),

  getAllMids: () => infoClient.allMids(),

  getAllPerpMetas: () => infoClient.allPerpMetas(),

  getPerpDexs: () => infoClient.perpDexs(),

  l2Book: (coin: string, nSigFigs?: 2 | 3 | 4 | 5 | null) => infoClient.l2Book({ coin, nSigFigs }),

  candleSnapshot: (
    coin: string,
    interval:
      | "1m"
      | "3m"
      | "5m"
      | "15m"
      | "30m"
      | "1h"
      | "2h"
      | "4h"
      | "8h"
      | "12h"
      | "1d"
      | "3d"
      | "1w"
      | "1M",
    startTime: number,
    endTime: number
  ) => infoClient.candleSnapshot({ coin, interval, startTime, endTime }),
};
