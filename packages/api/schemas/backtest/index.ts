import { Schema } from "effect";

const traceCorrelationFields = {
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
};

export const BacktestRunSchema = Schema.Struct({
  id: Schema.String,
  session_id: Schema.optional(Schema.String),
  strategy_version_id: Schema.String,
  dataset_snapshot_id: Schema.String,
  status: Schema.Union(
    Schema.Literal("queued"),
    Schema.Literal("pending"),
    Schema.Literal("initialized"),
    Schema.Literal("preparing"),
    Schema.Literal("running"),
    Schema.Literal("cancelling"),
    Schema.Literal("completed"),
    Schema.Literal("failed"),
    Schema.Literal("cancelled")
  ),
  engine_version: Schema.String,
  run_mode: Schema.Union(
    Schema.Literal("backtest"),
    Schema.Literal("paper"),
    Schema.Literal("live")
  ),
  initial_capital: Schema.Number,
  base_currency: Schema.String,
  created_by_action_id: Schema.optional(Schema.String),
  ...traceCorrelationFields,
  started_at: Schema.optional(Schema.String),
  finished_at: Schema.optional(Schema.String),
});

export type BacktestRun = typeof BacktestRunSchema.Type;

export const BacktestRunInputSchema = Schema.Struct({
  run_id: Schema.String,
  strategy_snapshot: Schema.Union(Schema.String, Schema.Unknown),
  dataset_snapshot_ref: Schema.Union(Schema.String, Schema.Unknown),
  execution_options: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  schema_version: Schema.String,
  created_at: Schema.String,
});

export type BacktestRunInput = typeof BacktestRunInputSchema.Type;

export const BacktestMetricSchema = Schema.Struct({
  run_id: Schema.String,
  metric_key: Schema.String,
  metric_value: Schema.Number,
  metric_group: Schema.String,
  created_at: Schema.String,
});

export type BacktestMetric = typeof BacktestMetricSchema.Type;

export const BacktestEventSchema = Schema.Struct({
  id: Schema.String,
  run_id: Schema.String,
  event_type: Schema.Union(
    Schema.Literal("order_placed"),
    Schema.Literal("order_filled"),
    Schema.Literal("order_cancelled"),
    Schema.Literal("position_opened"),
    Schema.Literal("position_closed"),
    Schema.Literal("signal"),
    Schema.Literal("error"),
    Schema.Literal("info")
  ),
  payload: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  level: Schema.Union(
    Schema.Literal("debug"),
    Schema.Literal("info"),
    Schema.Literal("warn"),
    Schema.Literal("error")
  ),
  ...traceCorrelationFields,
  parent_span_id: Schema.optional(Schema.String),
  created_at: Schema.String,
});

export type BacktestEvent = typeof BacktestEventSchema.Type;

export const RunSummarySchema = Schema.Struct({
  run: BacktestRunSchema,
  metrics: Schema.Array(BacktestMetricSchema),
  eventCount: Schema.Number,
});

export type RunSummary = typeof RunSummarySchema.Type;
