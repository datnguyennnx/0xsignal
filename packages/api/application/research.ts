import { Effect, Context, Layer } from "effect";
import { validationError, DomainError } from "./errors";
import type { ResearchNote, Artifact } from "@schemas/research";
import type { ResearchRepository } from "@infrastructure/repositories/research-repo";

type AppendResearchNoteInput = {
  id: string;
  session_id?: string;
  run_id?: string;
  strategy_version_id?: string;
  title: string;
  content_markdown?: string;
  tags?: string[];
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

type CreateArtifactInput = {
  id: string;
  run_id?: string;
  strategy_version_id?: string;
  artifact_type: "chart" | "report" | "model" | "data" | "config" | "log";
  storage_path: string;
  content_type?: string;
  size_bytes?: number;
  metadata?: string | unknown;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

export interface ResearchServices {
  appendResearchNote(
    input: AppendResearchNoteInput
  ): Effect.Effect<ResearchNote, DomainError, never>;
  createArtifact(input: CreateArtifactInput): Effect.Effect<Artifact, DomainError, never>;
}

export class ResearchServicesTag extends Context.Tag("ResearchServices")<
  ResearchServicesTag,
  ResearchServices
>() {}

export const makeResearchService = (repo: ResearchRepository): ResearchServices => ({
  appendResearchNote: (
    input: AppendResearchNoteInput
  ): Effect.Effect<ResearchNote, DomainError, never> =>
    Effect.tryPromise({
      try: () =>
        repo.insertNote({
          id: input.id,
          session_id: input.session_id,
          run_id: input.run_id,
          strategy_version_id: input.strategy_version_id,
          title: input.title,
          content_markdown: input.content_markdown,
          tags: input.tags,
          trace_id: input.trace_id,
          span_id: input.span_id,
          correlation_id: input.correlation_id,
          created_at: new Date().toISOString(),
        }),
      catch: (e) => validationError("Failed to append research note", e),
    }),

  createArtifact: (input: CreateArtifactInput): Effect.Effect<Artifact, DomainError, never> =>
    Effect.tryPromise({
      try: () =>
        repo.insertArtifact({
          id: input.id,
          run_id: input.run_id,
          strategy_version_id: input.strategy_version_id,
          artifact_type: input.artifact_type,
          storage_path: input.storage_path,
          content_type: input.content_type,
          size_bytes: input.size_bytes,
          metadata: input.metadata,
          trace_id: input.trace_id,
          span_id: input.span_id,
          correlation_id: input.correlation_id,
          created_at: new Date().toISOString(),
        }),
      catch: (e) => validationError("Failed to create artifact", e),
    }),
});

export const ResearchServicesLayer = (repo: ResearchRepository) =>
  Layer.succeed(ResearchServicesTag, makeResearchService(repo));
