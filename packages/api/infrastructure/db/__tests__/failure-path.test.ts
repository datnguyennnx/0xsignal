import { it, expect, describe, beforeAll, afterAll } from "@effect/vitest";
import { query, getPool, closePool } from "../postgres/client";

const shouldRunPostgres = process.env.RUN_POSTGRES_INTEGRATION === "1";

if (shouldRunPostgres) {
  describe("Failure-Path Persistence Tests", () => {
    let testSessionId: string;

    beforeAll(async () => {
      await getPool().query("SELECT 1");
      testSessionId = `fail-session-${Date.now()}`;
      await query(
        `INSERT INTO agent_sessions (id, source, objective, status, trace_id, span_id, correlation_id, request_id, started_at)
       VALUES ($1, 'test', 'Test session', 'running', 'trace-1', 'span-1', 'corr-1', 'req-1', $2)`,
        [testSessionId, new Date().toISOString()]
      );
    });

    afterAll(async () => {
      await query(`DELETE FROM agent_actions WHERE session_id = $1`, [testSessionId]);
      await query(`DELETE FROM agent_plans WHERE session_id = $1`, [testSessionId]);
      await query(`DELETE FROM agent_sessions WHERE id = $1`, [testSessionId]);
      await closePool();
    });

    describe("Failed Action Persistence", () => {
      it("action can store error code and error message", async () => {
        const failActionId = `fail-action-${Date.now()}`;
        await query(
          `INSERT INTO agent_actions (id, session_id, action_type, status, error_code, error_message, trace_id, span_id, correlation_id, request_id, created_at)
         VALUES ($1, $2, 'action', 'failed', 'ERR_STRATEGY', 'Strategy validation failed', 'trace-error', 'span-error', 'corr-1', 'req-error', $3)`,
          [failActionId, testSessionId, new Date().toISOString()]
        );
        const result = await query(
          `SELECT error_code, error_message FROM agent_actions WHERE id = $1`,
          [failActionId]
        );
        expect(result.rows[0]?.error_code).toBe("ERR_STRATEGY");
        expect(result.rows[0]?.error_message).toBe("Strategy validation failed");
        await query(`DELETE FROM agent_actions WHERE id = $1`, [failActionId]);
      });

      it("action failure includes input payload for debugging", async () => {
        const failActionId = `fail-action-payload-${Date.now()}`;
        await query(
          `INSERT INTO agent_actions (id, session_id, action_type, status, input_payload, error_code, trace_id, span_id, correlation_id, created_at)
         VALUES ($1, $2, 'action', 'failed', $3, 'ERR_JSON_PARSE', 'trace-pay', 'span-pay', 'corr-1', $4)`,
          [
            failActionId,
            testSessionId,
            JSON.stringify({ invalid_json: "{broken" }),
            new Date().toISOString(),
          ]
        );
        const result = await query(`SELECT input_payload FROM agent_actions WHERE id = $1`, [
          failActionId,
        ]);
        expect(result.rows[0]?.input_payload).toContain("invalid_json");
        await query(`DELETE FROM agent_actions WHERE id = $1`, [failActionId]);
      });
    });

    describe("Failed MCP Interaction Persistence", () => {
      it("MCP interaction can track failures", async () => {
        const mcpFailId = `mcp-fail-${Date.now()}`;
        await query(
          `INSERT INTO mcp_interactions (id, interaction_type, name, status, trace_id, span_id, correlation_id, created_at)
         VALUES ($1, 'tool_call', 'create_strategy', 'failed', 'mcp-trace', 'mcp-span', 'mcp-corr', $2)`,
          [mcpFailId, new Date().toISOString()]
        );
        const result = await query(`SELECT status, name FROM mcp_interactions WHERE id = $1`, [
          mcpFailId,
        ]);
        expect(result.rows[0]?.status).toBe("failed");
        expect(result.rows[0]?.name).toBe("create_strategy");
        await query(`DELETE FROM mcp_interactions WHERE id = $1`, [mcpFailId]);
      });
    });
  });
} else {
  describe("Failure-Path Persistence Tests integration gate", () => {
    it.skip("requires RUN_POSTGRES_INTEGRATION=1", () => {});
  });
}
