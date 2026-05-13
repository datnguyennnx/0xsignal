import { Effect, Context, Layer } from "effect";
import { DomainError } from "../errors";
import type { ResearchNote, Artifact } from "../../schemas/research";
import { ResearchRepository } from "../ports/research-repository";

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
  getNotesBySession(sessionId: string): Effect.Effect<ResearchNote[], DomainError, never>;
  getNotesByStrategy(strategyId: string): Effect.Effect<ResearchNote[], DomainError, never>;
  createArtifact(input: CreateArtifactInput): Effect.Effect<Artifact, DomainError, never>;
  getArtifactsByRun(runId: string): Effect.Effect<Artifact[], DomainError, never>;
}

export class ResearchServicesTag extends Context.Tag("ResearchServices")<
  ResearchServicesTag,
  ResearchServices
>() {}

export const makeResearchService = (repo: ResearchRepository): ResearchServices => ({
  appendResearchNote: (
    input: AppendResearchNoteInput
  ): Effect.Effect<ResearchNote, DomainError, never> =>
    repo
      .insertNote({
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
      })
      .pipe(
        Effect.mapError(
          (e) =>
            new DomainError({
              code: "VALIDATION_ERROR",
              message: "Failed to append research note",
              cause: e,
            })
        )
      ),

  getNotesBySession: (sessionId: string): Effect.Effect<ResearchNote[], DomainError, never> =>
    repo.getNotesBySession(sessionId).pipe(
      Effect.mapError(
        (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to load research notes for session",
            cause: e,
          })
      )
    ),

  getNotesByStrategy: (strategyId: string): Effect.Effect<ResearchNote[], DomainError, never> =>
    repo.getNotesByStrategy(strategyId).pipe(
      Effect.mapError(
        (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to load research notes for strategy",
            cause: e,
          })
      )
    ),

  createArtifact: (input: CreateArtifactInput): Effect.Effect<Artifact, DomainError, never> =>
    repo
      .insertArtifact({
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
      })
      .pipe(
        Effect.mapError(
          (e) =>
            new DomainError({
              code: "VALIDATION_ERROR",
              message: "Failed to create artifact",
              cause: e,
            })
        )
      ),

  getArtifactsByRun: (runId: string): Effect.Effect<Artifact[], DomainError, never> =>
    repo.getArtifactsByRun(runId).pipe(
      Effect.mapError(
        (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to load artifacts for run",
            cause: e,
          })
      )
    ),
});

export const ResearchServicesLive = Layer.effect(
  ResearchServicesTag,
  Effect.gen(function* () {
    const repo = yield* ResearchRepository;
    return makeResearchService(repo);
  })
);
