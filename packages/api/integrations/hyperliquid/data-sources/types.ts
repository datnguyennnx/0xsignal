import { Context, type Effect } from "effect";
import type { AggregatedMarket, Candle, MarketTicker } from "@0xsignal/shared";
import type { MarketTimeframe } from "../../../modules/market-data";
import type {
  AllMidsInfoResponse,
  L2BookInfoResponse,
  MetaAndAssetCtxsInfoResponse,
  MetaInfoResponse,
  PerpAnnotationInfoResponse,
  PerpCategoriesInfoResponse,
  PerpDexsInfoResponse,
  SpotMetaAndAssetCtxsInfoResponse,
  SpotMetaInfoResponse,
} from "@0xsignal/sdk-hyperliquid/info";
import type { HyperliquidError } from "./errors";

export type { Candle, MarketTicker as TickerPayload };

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
  readonly orderbook: L2BookInfoResponse;
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
    /** True once aggregated markets have populated the cache, via refresh or a fill. */
    readonly isWarm?: Effect.Effect<boolean> | undefined;
    readonly getTicker: (symbol: string) => Effect.Effect<MarketTicker, HyperliquidError>;
    readonly getOrderBook: (
      symbol: string,
      depth?: number | null,
    ) => Effect.Effect<OrderBookPayload, HyperliquidError>;
    readonly getTradeAnnotation: (
      symbol: string,
    ) => Effect.Effect<
      { symbol: string; annotation: PerpAnnotationInfoResponse },
      HyperliquidError
    >;
  }
>()("HyperliquidProvider") {}

/**
 * Subset of InfoClient methods used by the mapping/service layer.
 *
 * InfoClient from the SDK is structurally assignable to this narrower surface,
 * so no cast is needed to narrow it. Every method takes the params object the
 * SDK expects (never a `type` key); the absent-dex case is `{}`, not
 * `{ dex: undefined }`, because `exactOptionalPropertyTypes` rejects the latter.
 */
export type HyperliquidInfoClient = {
  readonly allMids: (p: { dex?: string }) => Promise<AllMidsInfoResponse>;
  readonly perpDexs: (p: Record<string, never>) => Promise<PerpDexsInfoResponse>;
  readonly spotMeta: (p: Record<string, never>) => Promise<SpotMetaInfoResponse>;
  readonly spotMetaAndAssetCtxs: (
    p: Record<string, never>,
  ) => Promise<SpotMetaAndAssetCtxsInfoResponse>;
  readonly perpCategories: (p: Record<string, never>) => Promise<PerpCategoriesInfoResponse>;
  readonly meta: (p: { dex?: string }) => Promise<MetaInfoResponse>;
  readonly metaAndAssetCtxs: (p: { dex?: string }) => Promise<MetaAndAssetCtxsInfoResponse>;
};
