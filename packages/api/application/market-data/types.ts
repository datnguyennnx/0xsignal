import type { MarketTimeframe } from "../../domain/market-data/timeframe";
import type { MarketTicker, AggregatedMarket, MarketTypeCategory } from "@0xsignal/shared";

export type MarketOrderBook = {
  readonly symbol: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
  readonly orderbook: unknown;
};

export type MarketTradeAnnotation = {
  readonly symbol: string;
  readonly annotation: unknown;
};

export type CandleQuery = {
  readonly symbol: string;
  readonly exchange: string;
  readonly timeframe: MarketTimeframe;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly limit?: number;
  readonly disableLimitForRange?: boolean;
};

export type RecentCandleQuery = {
  readonly symbol: string;
  readonly exchange?: string;
  readonly timeframe: MarketTimeframe;
  readonly endTime?: Date;
  readonly limit?: number;
};

export type { MarketTicker, AggregatedMarket, MarketTypeCategory };
