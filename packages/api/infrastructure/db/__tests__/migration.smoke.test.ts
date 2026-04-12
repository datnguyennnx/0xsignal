import { it, expect, describe, beforeAll, afterAll } from "@effect/vitest";
import { query, getPool, closePool } from "../postgres/client";

const MIGRATION_TABLES = [
  "agent_sessions",
  "agent_plans",
  "agent_actions",
  "strategy_definitions",
  "strategy_versions",
  "candlestick_requests",
  "dataset_snapshots",
  "backtest_runs",
  "backtest_run_inputs",
  "backtest_metrics",
  "backtest_events",
  "research_notes",
  "artifacts",
  "mcp_interactions",
] as const;

describe("Migration Smoke Tests", () => {
  beforeAll(async () => {
    const pool = getPool();
    await pool.query("SELECT 1");
  });

  afterAll(async () => {
    await closePool();
  });

  describe("Agent Core Tables", () => {
    it("agent_sessions table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_sessions'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });

    it("agent_sessions has required columns", async () => {
      const result = await query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'agent_sessions' 
        AND column_name IN ('id', 'source', 'objective', 'status', 'trace_id', 'span_id', 'correlation_id', 'request_id')
      `);
      expect(result.rows.length).toBeGreaterThanOrEqual(8);
    });

    it("agent_plans table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_plans'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });

    it("agent_actions table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_actions'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });
  });

  describe("Strategy Core Tables", () => {
    it("strategy_definitions table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'strategy_definitions'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });

    it("strategy_versions table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'strategy_versions'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });
  });

  describe("Market Data Tables", () => {
    it("candlestick_requests table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'candlestick_requests'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });

    it("dataset_snapshots table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'dataset_snapshots'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });
  });

  describe("Backtest Core Tables", () => {
    it("backtest_runs table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'backtest_runs'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });

    it("backtest_run_inputs table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'backtest_run_inputs'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });

    it("backtest_metrics table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'backtest_metrics'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });

    it("backtest_events table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'backtest_events'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });
  });

  describe("Research Tables", () => {
    it("research_notes table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'research_notes'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });

    it("artifacts table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'artifacts'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });
  });

  describe("MCP Tables", () => {
    it("mcp_interactions table exists", async () => {
      const result = await query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'mcp_interactions'"
      );
      expect(result.rows[0]?.count).toBe("1");
    });

    it("mcp_interactions has correlation fields", async () => {
      const result = await query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'mcp_interactions' 
        AND column_name IN ('trace_id', 'span_id', 'correlation_id', 'request_id', 'parent_span_id')
      `);
      expect(result.rows.length).toBe(5);
    });
  });

  describe("Observability Fields", () => {
    it("expected tables have trace_id column", async () => {
      const EXPECTED_WITH_TRACE = [
        "agent_sessions",
        "agent_plans",
        "agent_actions",
        "strategy_versions",
        "candlestick_requests",
        "backtest_runs",
        "backtest_events",
        "research_notes",
        "artifacts",
        "mcp_interactions",
      ];

      const tablesWithTraceId: string[] = [];
      for (const table of EXPECTED_WITH_TRACE) {
        const result = await query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'trace_id'`,
          [table]
        );
        if (result.rows[0]) {
          tablesWithTraceId.push(table);
        }
      }
      expect(tablesWithTraceId.length).toBe(EXPECTED_WITH_TRACE.length);
    });
  });
});
