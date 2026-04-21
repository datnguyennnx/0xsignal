import { query } from "../db/postgres/client";
import type { ResearchNote, Artifact } from "@schemas/research";
import type { ResearchRepository } from "@application/ports/research-repository";

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

  async getNote(id: string): Promise<ResearchNote | null> {
    const sql = `SELECT * FROM research_notes WHERE id = $1`;
    const result = await query(sql, [id]);
    return result.rows[0] as ResearchNote | null;
  },

  async getNotesBySession(sessionId: string): Promise<ResearchNote[]> {
    const sql = `SELECT * FROM research_notes WHERE session_id = $1 ORDER BY created_at DESC`;
    const result = await query(sql, [sessionId]);
    return result.rows as ResearchNote[];
  },

  async getNotesByRun(runId: string): Promise<ResearchNote[]> {
    const sql = `SELECT * FROM research_notes WHERE run_id = $1 ORDER BY created_at DESC`;
    const result = await query(sql, [runId]);
    return result.rows as ResearchNote[];
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

  async getArtifact(id: string): Promise<Artifact | null> {
    const sql = `SELECT * FROM artifacts WHERE id = $1`;
    const result = await query(sql, [id]);
    return result.rows[0] as Artifact | null;
  },

  async getArtifactsByRun(runId: string): Promise<Artifact[]> {
    const sql = `SELECT * FROM artifacts WHERE run_id = $1 ORDER BY created_at DESC`;
    const result = await query(sql, [runId]);
    return result.rows as Artifact[];
  },
};
