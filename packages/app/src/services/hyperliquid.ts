/**
 * @overview Hyperliquid Info Client
 *
 * A specialized service for interacting with the Hyperliquid L1 API.
 * Uses a singleton pattern to maintain a single stateless client.
 *
 * @strategy Singleton transport/client to minimize overhead in a server-side and client-side context.
 * @benefit Type-safe access to Hyperliquid market data, L2 books, and candle snapshots.
 */
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

export interface SpotMetaToken {
  name: string;
  szDecimals: number;
  weiDecimals: number;
  index: number;
  tokenId: string;
  isCanonical: boolean;
  evmContract?: {
    address: string;
  };
  fullName?: string;
}

export interface SpotMetaUniverse {
  tokens: [number, number];
  name: string;
  index: number;
}

export interface SpotMeta {
  universe: SpotMetaUniverse[];
  tokens: SpotMetaToken[];
}

export interface SpotAssetCtx {
  coin: string;
  prevDayPx: string;
  dayNtlVlm: string;
  markPx: string;
  midPx: string | null;
  circulatingSupply: string;
  totalSupply: string;
  dayBaseVlm: string;
}

export interface SpotMetaAndAssetCtxsResponse {
  spotMeta: SpotMeta;
  assetCtxs: SpotAssetCtx[];
}

export interface PerpDex {
  dex: string;
  fullName: string;
  collateralToken: number;
  isCanonical: boolean;
  asset: number;
}

export interface OutcomeMeta {
  outcomes: Array<{
    outcome: number;
    name: string;
    description: string;
    sideSpecs: Array<{ name: string }>;
  }>;
}

export interface PerpAnnotation {
  category: string;
  description: string;
  displayName?: string;
  keywords?: string[];
}

export const hyperliquidApi = {
  getMeta: (dex?: string) => infoClient.meta({ dex }),

  getMetaAndAssetCtxs: (dex?: string) => infoClient.metaAndAssetCtxs({ dex }),

  getPerpCategories: () => infoClient.perpCategories(),

  getAllMids: () => infoClient.allMids(),

  getAllPerpMetas: () => infoClient.allPerpMetas(),

  getPerpDexs: () => infoClient.perpDexs(),

  getSpotMeta: () => infoClient.spotMeta(),

  getSpotMetaAndAssetCtxs: () => infoClient.spotMetaAndAssetCtxs(),

  getOutcomeMeta: () => infoClient.outcomeMeta(),

  getAllPerpMids: (dex?: string) => infoClient.allMids({ dex }),

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

  getPerpAnnotation: (coin: string) =>
    infoClient.perpAnnotation({ coin }) as Promise<PerpAnnotation | null>,
};
