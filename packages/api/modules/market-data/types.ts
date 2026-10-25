import type { MarketTimeframe } from "./timeframe";
import type { MarketTicker } from "@0xsignal/shared";

export type MarketOrderBook = {
  readonly symbol: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5 | null;
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
  readonly startTime?: Date | undefined;
  readonly endTime?: Date | undefined;
  readonly limit?: number | undefined;
};

export type RecentCandleQuery = {
  readonly symbol: string;
  readonly exchange?: string;
  readonly timeframe: MarketTimeframe;
  readonly endTime?: Date | undefined;
  readonly limit?: number | undefined;
};

export type { MarketTicker };
