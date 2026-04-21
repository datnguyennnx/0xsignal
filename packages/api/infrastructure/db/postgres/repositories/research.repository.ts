import { query } from "../client";
import type { ResearchNote, Artifact } from "../../../../schemas/research";
import type { ResearchRepository } from "../../../../application/ports/research-repository";

export const postgresResearchRepository: ResearchRepository = {
  async insertNote(note: ResearchNote): Promise<ResearchNote> {
    const sql = `
      INSERT INTO research_notes (id, session_id, run_id, strategy_version_id, title, content_markdown, tags, trace_id, span_id, correlation_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await query(sql, [
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

  async insertArtifact(artifact: Artifact): Promise<Artifact> {
    const sql = `
      INSERT INTO artifacts (id, run_id, strategy_version_id, artifact_type, storage_path, content_type, size_bytes, metadata, trace_id, span_id, correlation_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const result = await query(sql, [
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
};
