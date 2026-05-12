import type { MarketTimeframe } from "../../domain/market-data/timeframe";

export type MarketTicker = {
  readonly symbol: string;
  readonly mid: number | null;
  readonly markPx: number | null;
  readonly midPx: number | null;
  readonly prevDayPx: number | null;
  readonly dayNtlVlm: number | null;
  readonly openInterest: number | null;
  readonly funding: number | null;
};

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

export type RequestCandlesticksInput = {
  id: string;
  session_id?: string;
  symbol: string;
  exchange: string;
  base_timeframe: string;
  start_time?: string;
  end_time?: string;
  adjustments?: string | unknown;
  requested_by_action_id?: string;
  requested_by_interaction_id?: string;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

export type CreateDatasetSnapshotInput = {
  id: string;
  request_id: string;
  symbol: string;
  exchange: string;
  timeframe: string;
  start_time: string;
  end_time: string;
  query_fingerprint?: string;
  row_count: number;
  checksum?: string;
  source_series?: string | unknown;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

export type MarketTypeCategory = "perp" | "spot" | "outcome";

export type AggregatedMarket = {
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
  readonly dex: string;
  readonly assetId: number;
  readonly marketType: MarketTypeCategory;
  readonly markPx: string;
  readonly prevDayPx: string;
  readonly openInterest: string;
  readonly funding: string;
  readonly dayNtlVlm: string;
  readonly maxLeverage: number;
  readonly szDecimals: number;
};
