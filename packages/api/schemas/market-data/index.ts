import { Schema } from "effect";

const traceCorrelationFields = {
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
};

export const CandlestickRequestSchema = Schema.Struct({
  id: Schema.String,
  session_id: Schema.optional(Schema.String),
  symbol: Schema.String,
  exchange: Schema.String,
  base_timeframe: Schema.String,
  start_time: Schema.optional(Schema.String),
  end_time: Schema.optional(Schema.String),
  adjustments: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  requested_by_action_id: Schema.optional(Schema.String),
  ...traceCorrelationFields,
  request_id: Schema.optional(Schema.String),
  created_at: Schema.String,
});

export type CandlestickRequest = typeof CandlestickRequestSchema.Type;

export const DatasetSnapshotSchema = Schema.Struct({
  id: Schema.String,
  request_id: Schema.String,
  symbol: Schema.String,
  exchange: Schema.String,
  timeframe: Schema.String,
  start_time: Schema.String,
  end_time: Schema.String,
  query_fingerprint: Schema.optional(Schema.String),
  row_count: Schema.Number,
  checksum: Schema.optional(Schema.String),
  source_series: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  ...traceCorrelationFields,
  created_at: Schema.String,
});

export type DatasetSnapshot = typeof DatasetSnapshotSchema.Type;
