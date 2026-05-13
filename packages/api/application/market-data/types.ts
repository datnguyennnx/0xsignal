import type { MarketTimeframe } from "../../domain/market-data/timeframe";
import type { MarketTicker, AggregatedMarket, MarketTypeCategory } from "@0xsignal/shared";

// ─── Transport types (no shared equivalent) ──────────────────────────────

export type MarketOrderBook = {
  readonly symbol: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
  readonly orderbook: unknown;
};

export type MarketTradeAnnotation = {
  readonly symbol: string;
  readonly annotation: unknown;
};

// ─── Query / input types (internal to application layer) ─────────────────

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

export type { MarketTicker, AggregatedMarket, MarketTypeCategory };
