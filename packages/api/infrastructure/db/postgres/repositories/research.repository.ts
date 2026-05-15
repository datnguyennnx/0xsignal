import { Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../client";
import type { ResearchNote, Artifact } from "../../../../schemas/research";
import { ResearchRepository } from "../../../../application/ports/research-repository";
import { DomainError } from "../../../../application/errors";

const dbError = (method: string, cause: unknown) =>
  new DomainError({
    code: "INTERNAL_ERROR",
    message: `Database error in ResearchRepository.${method}`,
    cause,
  });

export const ResearchRepositoryLive = Layer.effect(
  ResearchRepository,
  Effect.gen(function* () {
    const pool = yield* PostgresConnectionPool;

    return {
      insertNote: (note: ResearchNote) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO research_notes (id, session_id, run_id, strategy_version_id, title, content_markdown, tags, trace_id, span_id, correlation_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
            const result = await pool.query(sql, [
              note.id,
              note.session_id,
              note.run_id,
              note.strategy_version_id,
              note.title,
              note.content_markdown,
              note.tags ?? null,
              note.trace_id,
              note.span_id,
              note.correlation_id,
              note.created_at,
            ]);
            return result.rows[0] as ResearchNote;
          },
          catch: (e) => dbError("insertNote", e),
        }),

      getNotesBySession: (sessionId: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM research_notes WHERE session_id = $1 ORDER BY created_at DESC`;
            const result = await pool.query(sql, [sessionId]);
            return result.rows as ResearchNote[];
          },
          catch: (e) => dbError("getNotesBySession", e),
        }),

      getNotesByStrategy: (strategyId: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM research_notes WHERE strategy_version_id = $1 ORDER BY created_at DESC`;
            const result = await pool.query(sql, [strategyId]);
            return result.rows as ResearchNote[];
          },
          catch: (e) => dbError("getNotesByStrategy", e),
        }),

      insertArtifact: (artifact: Artifact) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO artifacts (id, run_id, strategy_version_id, artifact_type, storage_path, content_type, size_bytes, metadata, trace_id, span_id, correlation_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
            const result = await pool.query(sql, [
              artifact.id,
              artifact.run_id,
              artifact.strategy_version_id,
              artifact.artifact_type,
              artifact.storage_path,
              artifact.content_type,
              artifact.size_bytes,
              artifact.metadata ? JSON.stringify(artifact.metadata) : null,
              artifact.trace_id,
              artifact.span_id,
              artifact.correlation_id,
              artifact.created_at,
            ]);
            return result.rows[0] as Artifact;
          },
          catch: (e) => dbError("insertArtifact", e),
        }),

      getArtifactsByRun: (runId: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM artifacts WHERE run_id = $1 ORDER BY created_at DESC`;
            const result = await pool.query(sql, [runId]);
            return result.rows as Artifact[];
          },
          catch: (e) => dbError("getArtifactsByRun", e),
        }),
    };
  })
);
