import { Context, type Effect } from "effect";
import type { Candle } from "@0xsignal/shared";
import type { MarketTimeframe } from "../../../domain/market-data/timeframe";
import type { L2BookResponse, PerpAnnotationResponse } from "@nktkas/hyperliquid/api/info";
import type { HyperliquidError } from "./errors";

// Perp/spot discriminated union types

export type MarketType = "perp" | "spot";

/** Base fields shared by ALL market types. */
interface BaseTradeAsset {
  readonly coin: string;
  readonly rawCoin: string;
  readonly displaySymbol: string;
  readonly dexPrefix: string | null;
  readonly isHip3: boolean;
  readonly quoteCurrency: string;
  readonly name: string;
  readonly category: string;
  readonly displayCategory: string;
  readonly isDelisted: boolean;
  readonly dex: "HYPERLIQUID";
  readonly assetId: number;
  readonly marketType: MarketType;
}

/** Perpetual market (HIP-1 main or HIP-3 builder). Has funding, OI, leverage. */
export interface PerpTradeAsset extends BaseTradeAsset {
  readonly marketType: "perp";
  readonly markPx: string;
  readonly prevDayPx: string;
  readonly openInterest: string;
  readonly funding: string;
  readonly dayNtlVlm: string;
  readonly maxLeverage: number;
  readonly szDecimals: number;
}

/** Spot market. No funding/OI, 1x leverage. */
export interface SpotTradeAsset extends BaseTradeAsset {
  readonly marketType: "spot";
  readonly markPx: string;
  readonly prevDayPx: string;
  readonly dayNtlVlm: string;
  readonly dayBaseVlm: string;
  readonly circulatingSupply?: string;
  readonly totalSupply?: string;
  readonly evmContract?: string;
  readonly maxLeverage: 1;
  readonly szDecimals: number;
  /** Spot markets always have zero funding with no open interest. */
  readonly openInterest: "0";
  readonly funding: "0";
}

export type HyperliquidAggregatedAsset = PerpTradeAsset | SpotTradeAsset;

export interface MarketUniverseItem {
  readonly name: string;
  readonly szDecimals?: number;
  readonly maxLeverage?: number;
  readonly isDelisted?: boolean;
  readonly dexIndex?: number;
  readonly displayName?: string;
  readonly tokens?: [number, number];
}

export type MarketAssetCtxItem = {
  readonly prevDayPx?: string;
  readonly dayNtlVlm?: string;
  readonly markPx?: string;
  readonly midPx?: string | null;
  readonly funding?: string;
  readonly openInterest?: string;
  readonly premium?: string | null;
};

export type TickerPayload = {
  readonly symbol: string;
  readonly mid: number | null;
  readonly markPx: number | null;
  readonly midPx: number | null;
  readonly prevDayPx: number | null;
  readonly dayNtlVlm: number | null;
  readonly openInterest: number | null;
  readonly funding: number | null;
};

export type OrderBookPayload = {
  readonly symbol: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
  readonly orderbook: L2BookResponse;
};

export type TickerSnapshot = {
  readonly universe: ReadonlyArray<MarketUniverseItem>;
  readonly assetCtxs: ReadonlyArray<MarketAssetCtxItem>;
  readonly allMids: Readonly<Record<string, string>>;
};

export class HyperliquidProvider extends Context.Service<
  HyperliquidProvider,
  {
    readonly getCandleSnapshot: (
      coin: string,
      interval: MarketTimeframe,
      startTime: number,
      endTime: number,
    ) => Effect.Effect<Candle[], HyperliquidError>;
    readonly getAllMids: () => Effect.Effect<Record<string, string>, HyperliquidError>;
    readonly getAggregatedMarkets: () => Effect.Effect<
      readonly HyperliquidAggregatedAsset[],
      HyperliquidError
    >;
    readonly getTicker: (symbol: string) => Effect.Effect<TickerPayload, HyperliquidError>;
    readonly getOrderBook: (
      symbol: string,
      depth?: number,
    ) => Effect.Effect<OrderBookPayload, HyperliquidError>;
    readonly getTradeAnnotation: (
      symbol: string,
    ) => Effect.Effect<{ symbol: string; annotation: PerpAnnotationResponse }, HyperliquidError>;
  }
>()("HyperliquidProvider") {}

/**
 * Subset of InfoClient methods used by the mapping/service layer.
 *
 * InfoClient from the library has a larger interface, but this type narrows
 * it to only the methods actually consumed. Casts are required because
 * TypeScript cannot verify structural compatibility with the external type.
 */
export type HyperliquidInfoClient = {
  readonly metaAndAssetCtxs: (params?: { dex?: string }) => Promise<[unknown, unknown]>;
  readonly allMids: () => Promise<Record<string, string>>;
  readonly perpCategories?: () => Promise<unknown>;
  readonly perpDexs?: () => Promise<Array<null | { name: string }>>;
  readonly spotMeta?: () => Promise<unknown>;
  readonly spotMetaAndAssetCtxs?: () => Promise<unknown>;
};
