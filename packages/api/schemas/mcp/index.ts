import { Schema } from "effect";

const traceCorrelationFields = {
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
  request_id: Schema.optional(Schema.String),
};

export const McpInteractionSchema = Schema.Struct({
  id: Schema.String,
  session_id: Schema.optional(Schema.String),
  interaction_type: Schema.Union(
    Schema.Literal("tool_call"),
    Schema.Literal("resource_access"),
    Schema.Literal("prompt"),
    Schema.Literal("message")
  ),
  name: Schema.String,
  input_payload: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  output_payload: Schema.optional(Schema.Union(Schema.String, Schema.Unknown)),
  status: Schema.Union(
    Schema.Literal("pending"),
    Schema.Literal("running"),
    Schema.Literal("completed"),
    Schema.Literal("failed")
  ),
  ...traceCorrelationFields,
  parent_span_id: Schema.optional(Schema.String),
  created_at: Schema.String,
});

export type McpInteraction = typeof McpInteractionSchema.Type;
