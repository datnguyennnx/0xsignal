import { Context, type Effect } from "effect";
import type { AggregatedMarket, Candle, MarketTicker } from "@0xsignal/shared";
import type { MarketTimeframe } from "../../../modules/market-data";
import type { L2BookResponse, PerpAnnotationResponse } from "@nktkas/hyperliquid/api/info";
import type { HyperliquidError } from "./errors";

export type { Candle, MarketTicker as TickerPayload };
export type { PerpAnnotationResponse } from "@nktkas/hyperliquid/api/info";

// Perp/spot discriminated union types

/** Narrowed to the only venue this data source serves; the rest is the shared contract. */
interface BaseTradeAsset extends AggregatedMarket {
  readonly dex: "HYPERLIQUID";
}

/** Perpetual market (HIP-1 main or HIP-3 builder). Inherits funding, OI and leverage. */
export interface PerpTradeAsset extends BaseTradeAsset {
  readonly marketType: "perp";
}

/** Spot market. Adds supply/volume fields that never cross the boundary. */
export interface SpotTradeAsset extends BaseTradeAsset {
  readonly marketType: "spot";
  readonly dayBaseVlm: string;
  readonly totalSupply?: string | undefined;
  readonly maxLeverage: 1;
  /** Spot markets always have zero funding with no open interest. */
  readonly openInterest: "0";
  readonly funding: "0";
}

export type HyperliquidAggregatedAsset = PerpTradeAsset | SpotTradeAsset;

export interface MarketUniverseItem {
  readonly name: string;
  readonly szDecimals?: number | undefined;
  readonly maxLeverage?: number | undefined;
  readonly isDelisted?: boolean | undefined;
  readonly dexIndex?: number | undefined;
  readonly displayName?: string | undefined;
  readonly tokens?: [number, number];
}

export type MarketAssetCtxItem = {
  readonly prevDayPx?: string | undefined;
  readonly dayNtlVlm?: string | undefined;
  readonly markPx?: string | undefined;
  readonly midPx?: string | null | undefined;
  readonly funding?: string | undefined;
  readonly openInterest?: string | undefined;
  readonly premium?: string | null | undefined;
};

export type OrderBookPayload = {
  readonly symbol: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5 | null;
  readonly orderbook: L2BookResponse;
};

export type TickerSnapshot = {
  readonly universe: ReadonlyArray<MarketUniverseItem>;
  readonly assetCtxs: ReadonlyArray<MarketAssetCtxItem>;
  readonly allMids: Readonly<Record<string, string>>;
  /** Index-aligned with `MarketUniverseItem.dexIndex`; "" is the main dex. */
  readonly dexNames?: ReadonlyArray<string> | undefined;
  /** Present only for all-dex snapshots; maps a spot token to its pair query name. */
  readonly spotPairs?: ReadonlyArray<SpotPairRef> | undefined;
};

export type SpotPairRef = {
  readonly token: string;
  readonly queryName: string;
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
    readonly getTicker: (symbol: string) => Effect.Effect<MarketTicker, HyperliquidError>;
    readonly getOrderBook: (
      symbol: string,
      depth?: number | null,
    ) => Effect.Effect<OrderBookPayload, HyperliquidError>;
    readonly getTradeAnnotation: (
      symbol: string,
    ) => Effect.Effect<{ symbol: string; annotation: PerpAnnotationResponse }, HyperliquidError>;
  }
>()("HyperliquidProvider") {}

/**
 * Subset of InfoClient methods used by the mapping/service layer.
 *
 * InfoClient from the library exposes more methods, but it is structurally
 * assignable to this narrower surface, so no cast is needed to narrow it.
 */
export type HyperliquidInfoClient = {
  readonly metaAndAssetCtxs: (params?: { dex?: string }) => Promise<[unknown, unknown]>;
  readonly allMids: () => Promise<Record<string, string>>;
  readonly perpCategories?: () => Promise<Array<[string, string]>>;
  readonly perpDexs?: () => Promise<Array<null | { name: string }>>;
  readonly spotMeta?: () => Promise<unknown>;
  readonly spotMetaAndAssetCtxs?: () => Promise<unknown>;
};
