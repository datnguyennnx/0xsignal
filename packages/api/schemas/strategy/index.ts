import { Schema } from "effect";

const traceCorrelationFields = {
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
};

export const StrategyDefinitionSchema = Schema.Struct({
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
  created_at: Schema.String,
});

export type StrategyDefinition = typeof StrategyDefinitionSchema.Type;

export const StrategyVersionSchema = Schema.Struct({
  id: Schema.String,
  strategy_id: Schema.String,
  parent_version_id: Schema.optional(Schema.String),
  version: Schema.Number,
  config: Schema.Union(Schema.String, Schema.Unknown),
  change_reason: Schema.optional(Schema.String),
  created_by_action_id: Schema.optional(Schema.String),
  schema_version: Schema.String,
  ...traceCorrelationFields,
  created_at: Schema.String,
});

export type StrategyVersion = typeof StrategyVersionSchema.Type;

export const StrategyChangeRecordSchema = Schema.Struct({
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
  ...traceCorrelationFields,
  created_at: Schema.String,
});

export type StrategyChangeRecord = typeof StrategyChangeRecordSchema.Type;

export const StrategyHistorySchema = Schema.Struct({
  strategy: StrategyDefinitionSchema,
  versions: Schema.Array(StrategyVersionSchema),
  changes: Schema.Array(StrategyChangeRecordSchema),
});

export type StrategyHistory = typeof StrategyHistorySchema.Type;
