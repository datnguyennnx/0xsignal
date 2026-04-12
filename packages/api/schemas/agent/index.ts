import { Schema } from "effect";

const traceCorrelationFields = {
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
  request_id: Schema.optional(Schema.String),
};

export const AgentSessionSchema = Schema.Struct({
  id: Schema.String,
  source: Schema.String,
  objective: Schema.String,
  status: Schema.Union(
    Schema.Literal("pending"),
    Schema.Literal("running"),
    Schema.Literal("completed"),
    Schema.Literal("failed"),
    Schema.Literal("cancelled")
  ),
  context_scope: Schema.optional(Schema.String),
  ...traceCorrelationFields,
  actor_kind: Schema.optional(Schema.String),
  actor_name: Schema.optional(Schema.String),
  source_system: Schema.optional(Schema.String),
  started_at: Schema.optional(Schema.String),
  ended_at: Schema.optional(Schema.String),
});

export type AgentSession = typeof AgentSessionSchema.Type;

export const AgentPlanSchema = Schema.Struct({
  id: Schema.String,
  session_id: Schema.String,
  version: Schema.Number,
  title: Schema.String,
  content_markdown: Schema.optional(Schema.String),
  structured_plan: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  ...traceCorrelationFields,
  created_at: Schema.String,
});

export type AgentPlan = typeof AgentPlanSchema.Type;

export const AgentActionSchema = Schema.Struct({
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
  created_at: Schema.String,
});

export type AgentAction = typeof AgentActionSchema.Type;
