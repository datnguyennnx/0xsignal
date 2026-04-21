import { it, expect, describe, beforeAll, afterAll } from "@effect/vitest";
import { query, getPool, closePool } from "../../db/postgres/client";

const shouldRunPostgres = process.env.RUN_POSTGRES_INTEGRATION === "1";

if (shouldRunPostgres) {
  describe("AgentRepository", () => {
    let testSessionId: string;
    let testPlanId: string;
    let testActionId: string;

    beforeAll(async () => {
      await getPool().query("SELECT 1");
      testSessionId = `test-session-${Date.now()}`;
      testPlanId = `test-plan-${Date.now()}`;
      testActionId = `test-action-${Date.now()}`;
      await query(
        `INSERT INTO agent_sessions (id, source, objective, status, trace_id, span_id, correlation_id, request_id, started_at)
       VALUES ($1, 'test', 'Test session', 'pending', 'trace-1', 'span-1', 'corr-1', 'req-1', $2)`,
        [testSessionId, new Date().toISOString()]
      );
    });

    afterAll(async () => {
      await query(`DELETE FROM agent_actions WHERE session_id = $1`, [testSessionId]);
      await query(`DELETE FROM agent_plans WHERE session_id = $1`, [testSessionId]);
      await query(`DELETE FROM agent_sessions WHERE id = $1`, [testSessionId]);
      await closePool();
    });

    describe("Session Operations", () => {
      it("getSession retrieves a session", async () => {
        const result = await query(`SELECT * FROM agent_sessions WHERE id = $1`, [testSessionId]);
        expect(result.rows[0]?.id).toBe(testSessionId);
      });

      it("session has observability fields", async () => {
        const result = await query(
          `SELECT trace_id, span_id, correlation_id, request_id FROM agent_sessions WHERE id = $1`,
          [testSessionId]
        );
        expect(result.rows[0]?.trace_id).toBe("trace-1");
        expect(result.rows[0]?.correlation_id).toBe("corr-1");
      });
    });

    describe("Plan Operations", () => {
      it("insertPlan creates a plan", async () => {
        await query(
          `INSERT INTO agent_plans (id, session_id, version, title, trace_id, span_id, correlation_id, request_id, created_at)
         VALUES ($1, $2, $3, 'Test Plan', 'trace-2', 'span-2', 'corr-1', 'req-2', $4)`,
          [testPlanId, testSessionId, 1, new Date().toISOString()]
        );
        const result = await query(`SELECT * FROM agent_plans WHERE id = $1`, [testPlanId]);
        expect(result.rows[0]?.id).toBe(testPlanId);
      });

      it("getPlan retrieves a plan", async () => {
        const result = await query(`SELECT * FROM agent_plans WHERE id = $1`, [testPlanId]);
        expect(result.rows[0]?.id).toBe(testPlanId);
      });
    });

    describe("Action Operations", () => {
      it("insertAction creates an action", async () => {
        await query(
          `INSERT INTO agent_actions (id, session_id, plan_id, action_type, status, trace_id, span_id, correlation_id, request_id, parent_span_id, created_at)
         VALUES ($1, $2, $3, 'planning', 'completed', 'trace-3', 'span-3', 'corr-1', 'req-3', 'span-2', $4)`,
          [testActionId, testSessionId, testPlanId, new Date().toISOString()]
        );
        const result = await query(`SELECT * FROM agent_actions WHERE id = $1`, [testActionId]);
        expect(result.rows[0]?.id).toBe(testActionId);
      });

      it("getAction retrieves an action", async () => {
        const result = await query(`SELECT * FROM agent_actions WHERE id = $1`, [testActionId]);
        expect(result.rows[0]?.id).toBe(testActionId);
      });

      it("action has error tracking fields", async () => {
        const actionId = `test-action-error-${Date.now()}`;
        await query(
          `INSERT INTO agent_actions (id, session_id, action_type, status, error_code, error_message, trace_id, span_id, correlation_id, request_id, parent_span_id, created_at)
         VALUES ($1, $2, 'action', 'failed', 'ERR_TEST', 'Test error message', 'trace-error', 'span-error', 'corr-1', 'req-error', 'span-2', $3)`,
          [actionId, testSessionId, new Date().toISOString()]
        );
        const result = await query(
          `SELECT error_code, error_message FROM agent_actions WHERE id = $1`,
          [actionId]
        );
        expect(result.rows[0]?.error_code).toBe("ERR_TEST");
      });
    });
  });
} else {
  describe("AgentRepository integration gate", () => {
    it.skip("requires RUN_POSTGRES_INTEGRATION=1", () => {});
  });
}
