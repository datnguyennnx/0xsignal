import { Schema } from "effect";

const traceCorrelationFields = {
  trace_id: Schema.optional(Schema.String),
  span_id: Schema.optional(Schema.String),
  correlation_id: Schema.optional(Schema.String),
};

export const ResearchNoteSchema = Schema.Struct({
  id: Schema.String,
  session_id: Schema.optional(Schema.String),
  run_id: Schema.optional(Schema.String),
  strategy_version_id: Schema.optional(Schema.String),
  title: Schema.String,
  content_markdown: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  ...traceCorrelationFields,
  created_at: Schema.String,
});

export type ResearchNote = typeof ResearchNoteSchema.Type;

export const ArtifactSchema = Schema.Struct({
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
  ...traceCorrelationFields,
  created_at: Schema.String,
});

export type Artifact = typeof ArtifactSchema.Type;
