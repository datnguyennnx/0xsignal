import { Schema } from "effect";

const traceCorrelationFields = {
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
  request_id: Schema.optional(Schema.String),
};

export const OpenSessionInputSchema = Schema.Struct({
  id: Schema.String,
  source: Schema.String,
  objective: Schema.String,
  context_scope: Schema.optional(Schema.String),
  actor_kind: Schema.optional(Schema.String),
  actor_name: Schema.optional(Schema.String),
  source_system: Schema.optional(Schema.String),
  ...traceCorrelationFields,
});

export type OpenSessionInput = typeof OpenSessionInputSchema.Type;

export const GetSessionInputSchema = Schema.Struct({
  id: Schema.String,
});

export type GetSessionInput = typeof GetSessionInputSchema.Type;

export const SavePlanInputSchema = Schema.Struct({
  id: Schema.String,
  session_id: Schema.String,
  version: Schema.Number,
  title: Schema.String,
  content_markdown: Schema.optional(Schema.String),
  structured_plan: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  ...traceCorrelationFields,
});

export type SavePlanInput = typeof SavePlanInputSchema.Type;

export const RecordActionInputSchema = Schema.Struct({
  id: Schema.String,
  session_id: Schema.String,
  plan_id: Schema.optional(Schema.String),
  action_type: Schema.Union(
    Schema.Literal("thought"),
    Schema.Literal("action"),
    Schema.Literal("observation"),
    Schema.Literal("planning"),
    Schema.Literal("reasoning")
  ),
  target_type: Schema.optional(Schema.String),
  target_id: Schema.optional(Schema.String),
  input_payload: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  result_payload: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  status: Schema.Union(
    Schema.Literal("pending"),
    Schema.Literal("running"),
    Schema.Literal("completed"),
    Schema.Literal("failed")
  ),
  error_code: Schema.optional(Schema.String),
  error_message: Schema.optional(Schema.String),
  ...traceCorrelationFields,
  parent_span_id: Schema.optional(Schema.String),
});

export type RecordActionInput = typeof RecordActionInputSchema.Type;

export const CreateStrategyDefinitionInputSchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  market_type: Schema.Union(
    Schema.Literal("crypto"),
    Schema.Literal("forex"),
    Schema.Literal("equity"),
    Schema.Literal("commodity")
  ),
  owner_type: Schema.Union(
    Schema.Literal("user"),
    Schema.Literal("system"),
    Schema.Literal("shared")
  ),
  ...traceCorrelationFields,
});

export type CreateStrategyDefinitionInput = typeof CreateStrategyDefinitionInputSchema.Type;

export const CreateStrategyVersionInputSchema = Schema.Struct({
  id: Schema.String,
  strategy_id: Schema.String,
  parent_version_id: Schema.optional(Schema.String),
  version: Schema.Number,
  config: Schema.Union(Schema.String, Schema.Unknown),
  change_reason: Schema.optional(Schema.String),
  created_by_action_id: Schema.optional(Schema.String),
  schema_version: Schema.String,
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
});

export type CreateStrategyVersionInput = typeof CreateStrategyVersionInputSchema.Type;

export const RecordStrategyChangeInputSchema = Schema.Struct({
  id: Schema.String,
  strategy_version_id: Schema.String,
  change_type: Schema.Union(
    Schema.Literal("create"),
    Schema.Literal("update"),
    Schema.Literal("delete"),
    Schema.Literal("restore")
  ),
  path: Schema.String,
  previous_value: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  next_value: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  summary: Schema.optional(Schema.String),
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
});

export type RecordStrategyChangeInput = typeof RecordStrategyChangeInputSchema.Type;

export const RequestCandlesticksInputSchema = Schema.Struct({
  id: Schema.String,
  session_id: Schema.optional(Schema.String),
  symbol: Schema.String,
  exchange: Schema.String,
  base_timeframe: Schema.String,
  start_time: Schema.optional(Schema.String),
  end_time: Schema.optional(Schema.String),
  adjustments: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  requested_by_action_id: Schema.optional(Schema.String),
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
});

export type RequestCandlesticksInput = typeof RequestCandlesticksInputSchema.Type;

export const CreateDatasetSnapshotInputSchema = Schema.Struct({
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
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
});

export type CreateDatasetSnapshotInput = typeof CreateDatasetSnapshotInputSchema.Type;

export const GetDatasetSnapshotInputSchema = Schema.Struct({
  id: Schema.String,
});

export type GetDatasetSnapshotInput = typeof GetDatasetSnapshotInputSchema.Type;

export const CreateBacktestRunInputSchema = Schema.Struct({
  id: Schema.String,
  session_id: Schema.optional(Schema.String),
  strategy_version_id: Schema.String,
  dataset_snapshot_id: Schema.String,
  status: Schema.Union(
    Schema.Literal("pending"),
    Schema.Literal("running"),
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
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
});

export type CreateBacktestRunInput = typeof CreateBacktestRunInputSchema.Type;

export const GetRunSummaryInputSchema = Schema.Struct({
  id: Schema.String,
});

export type GetRunSummaryInput = typeof GetRunSummaryInputSchema.Type;

export const AppendRunEventInputSchema = Schema.Struct({
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
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
  parent_span_id: Schema.optional(Schema.String),
});

export type AppendRunEventInput = typeof AppendRunEventInputSchema.Type;

export const RecordMetricInputSchema = Schema.Struct({
  run_id: Schema.String,
  metric_key: Schema.String,
  metric_value: Schema.Number,
  metric_group: Schema.String,
});

export type RecordMetricInput = typeof RecordMetricInputSchema.Type;

export const AppendResearchNoteInputSchema = Schema.Struct({
  id: Schema.String,
  session_id: Schema.optional(Schema.String),
  run_id: Schema.optional(Schema.String),
  strategy_version_id: Schema.optional(Schema.String),
  title: Schema.String,
  content_markdown: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
});

export type AppendResearchNoteInput = typeof AppendResearchNoteInputSchema.Type;

export const CreateArtifactInputSchema = Schema.Struct({
  id: Schema.String,
  run_id: Schema.optional(Schema.String),
  strategy_version_id: Schema.optional(Schema.String),
  artifact_type: Schema.Union(
    Schema.Literal("chart"),
    Schema.Literal("report"),
    Schema.Literal("model"),
    Schema.Literal("data"),
    Schema.Literal("config"),
    Schema.Literal("log")
  ),
  storage_path: Schema.String,
  content_type: Schema.optional(Schema.String),
  size_bytes: Schema.optional(Schema.Number),
  metadata: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
});

export type CreateArtifactInput = typeof CreateArtifactInputSchema.Type;
