import { beforeAll, afterAll, describe, expect, it } from "@effect/vitest";
import { getPool, query, closePool } from "../postgres/client";

describe("Integrity invariant constraints", () => {
  beforeAll(async () => {
    await getPool().query("SELECT 1");
  });

  afterAll(async () => {
    await closePool();
  });

  it("rejects duplicate plan versions per session", async () => {
    const sessionId = `session-plan-${Date.now()}`;
    const planA = `plan-a-${Date.now()}`;
    const planB = `plan-b-${Date.now()}`;

    await query(
      `INSERT INTO agent_sessions (id, source, objective, status, started_at) VALUES ($1, 'test', 'dup plan', 'pending', NOW())`,
      [sessionId]
    );

    await query(
      `INSERT INTO agent_plans (id, session_id, version, title, created_at) VALUES ($1, $2, 1, 'v1', NOW())`,
      [planA, sessionId]
    );

    await expect(
      query(
        `INSERT INTO agent_plans (id, session_id, version, title, created_at) VALUES ($1, $2, 1, 'v1-dup', NOW())`,
        [planB, sessionId]
      )
    ).rejects.toThrow();

    await query(`DELETE FROM agent_plans WHERE session_id = $1`, [sessionId]);
    await query(`DELETE FROM agent_sessions WHERE id = $1`, [sessionId]);
  });

  it("rejects duplicate strategy versions per strategy", async () => {
    const strategyId = `strategy-${Date.now()}`;
    const versionA = `sv-a-${Date.now()}`;
    const versionB = `sv-b-${Date.now()}`;

    await query(
      `INSERT INTO strategy_definitions (id, slug, name, market_type, owner_type, created_at)
       VALUES ($1, $2, 'S', 'crypto', 'user', NOW())`,
      [strategyId, `slug-${Date.now()}`]
    );

    await query(
      `INSERT INTO strategy_versions (id, strategy_id, version, config, schema_version, created_at)
       VALUES ($1, $2, 1, '{}'::jsonb, '1.0', NOW())`,
      [versionA, strategyId]
    );

    await expect(
      query(
        `INSERT INTO strategy_versions (id, strategy_id, version, config, schema_version, created_at)
         VALUES ($1, $2, 1, '{}'::jsonb, '1.0', NOW())`,
        [versionB, strategyId]
      )
    ).rejects.toThrow();

    await query(`DELETE FROM strategy_versions WHERE strategy_id = $1`, [strategyId]);
    await query(`DELETE FROM strategy_definitions WHERE id = $1`, [strategyId]);
  });

  it("rejects orphan research note", async () => {
    await expect(
      query(
        `INSERT INTO research_notes (id, title, content_markdown, created_at)
         VALUES ($1, 'orphan note', 'no anchors', NOW())`,
        [`note-${Date.now()}`]
      )
    ).rejects.toThrow();
  });

  it("rejects orphan artifact", async () => {
    await expect(
      query(
        `INSERT INTO artifacts (id, artifact_type, storage_path, created_at)
         VALUES ($1, 'report', '/tmp/r.txt', NOW())`,
        [`artifact-${Date.now()}`]
      )
    ).rejects.toThrow();
  });
});
