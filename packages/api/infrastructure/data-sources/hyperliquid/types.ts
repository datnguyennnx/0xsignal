import { Context, type Effect } from "effect";
import type { Candle } from "../../../schemas/market-data";
import type { MarketTimeframe } from "../../../domain/market-data/timeframe";
import type { L2BookResponse, PerpAnnotationResponse } from "@nktkas/hyperliquid/api/info";
import type { HyperliquidError } from "./errors";

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

export type MarketsSnapshot = {
  readonly universe: ReadonlyArray<MarketUniverseItem>;
  readonly assetCtxs: ReadonlyArray<MarketAssetCtxItem>;
  readonly allMids: Readonly<Record<string, string>>;
  readonly perpCategories: ReadonlyArray<readonly [string, string]>;
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

export type TickerSnapshot = Pick<MarketsSnapshot, "universe" | "assetCtxs" | "allMids">;

export class HyperliquidProvider extends Context.Tag("HyperliquidProvider")<
  HyperliquidProvider,
  {
    readonly getCandleSnapshot: (
      coin: string,
      interval: MarketTimeframe,
      startTime: number,
      endTime: number
    ) => Effect.Effect<Candle[], HyperliquidError>;
    readonly getAllMids: () => Effect.Effect<Record<string, string>, HyperliquidError>;
    readonly getMetadata: () => Effect.Effect<MarketsSnapshot, HyperliquidError>;
    readonly getTicker: (symbol: string) => Effect.Effect<TickerPayload, HyperliquidError>;
    readonly getOrderBook: (
      symbol: string,
      depth?: number
    ) => Effect.Effect<OrderBookPayload, HyperliquidError>;
    readonly getTradeAnnotation: (
      symbol: string
    ) => Effect.Effect<{ symbol: string; annotation: PerpAnnotationResponse }, HyperliquidError>;
  }
>() {}
