import { it, expect, describe, beforeAll, afterAll } from "@effect/vitest";
import { query, getPool, closePool } from "@infrastructure/db/postgres/client";

describe("Backtest Reproducibility", () => {
  let testStrategyVersionId: string;
  let testDatasetSnapshotId: string;
  let testRunId: string;

  const frozenInput = {
    symbol: "BTC/USD",
    interval: "1h",
    start_time: "2024-01-01T00:00:00Z",
    end_time: "2024-12-31T23:59:59Z",
    initial_capital: 50000,
    base_currency: "USD",
    engine_version: "1.0.0",
    parameters: {
      ma_period: 20,
      rsi_period: 14,
      position_sizing: "fixed",
    },
  };

  beforeAll(async () => {
    await getPool().query("SELECT 1");
    testStrategyVersionId = `test-strategy-${Date.now()}`;
    testDatasetSnapshotId = `testsnapshot-${Date.now()}`;
    testRunId = `test-run-${Date.now()}`;
    await query(
      `INSERT INTO strategy_versions (id, definition_id, version, code_content, description, parameters_schema, trace_id, span_id, correlation_id, created_at)
       VALUES ($1, $2, $1, '// test code', 'Test strategy', '{}', 'trace-test', 'span-test', 'corr-test', $3)`,
      [testStrategyVersionId, `${testStrategyVersionId}-def`, new Date().toISOString()]
    );
    await query(
      `INSERT INTO dataset_snapshots (id, request_id, symbol, interval, start_time, end_time, data_points, status, trace_id, span_id, correlation_id, created_at)
       VALUES ($1, 'req-1', 'BTC/USD', '1h', '2024-01-01', '2024-12-31', 8760, 'completed', 'trace-test', 'span-test', 'corr-test', $2)`,
      [testDatasetSnapshotId, new Date().toISOString()]
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM backtest_run_inputs WHERE run_id = $1`, [testRunId]);
    await query(`DELETE FROM backtest_runs WHERE id = $1`, [testRunId]);
    await query(`DELETE FROM dataset_snapshots WHERE id = $1`, [testDatasetSnapshotId]);
    await query(`DELETE FROM strategy_versions WHERE id = $1`, [testStrategyVersionId]);
    await closePool();
  });

  describe("Run Input Freezing", () => {
    it("run input can be stored", async () => {
      // First, create the backtest run
      await query(
        `INSERT INTO backtest_runs (id, strategy_version_id, dataset_snapshot_id, status, run_mode, initial_capital, base_currency, trace_id, span_id, correlation_id, created_at)
         VALUES ($1, $2, $3, 'pending', 'backtest', 50000, 'USD', 'trace-run', 'span-run', 'corr-run', $4)`,
        [testRunId, testStrategyVersionId, testDatasetSnapshotId, new Date().toISOString()]
      );

      await query(
        `INSERT INTO backtest_run_inputs (run_id, strategy_snapshot, dataset_snapshot_ref, execution_options, schema_version, created_at)
         VALUES ($1, $2, $3, $4, '1.0', $5)`,
        [
          testRunId,
          JSON.stringify(frozenInput.parameters),
          JSON.stringify({ id: "ref" }),
          JSON.stringify({ initial_capital: 50000 }),
          new Date().toISOString(),
        ]
      );
      const result = await query(
        `SELECT execution_options FROM backtest_run_inputs WHERE run_id = $1`,
        [testRunId]
      );
      const storedInput = result.rows[0]?.execution_options;
      expect(storedInput.initial_capital).toBe(50000);
    });

    it("run input contains all parameters needed for replay", async () => {
      const result = await query(
        `SELECT strategy_snapshot, execution_options FROM backtest_run_inputs WHERE run_id = $1`,
        [testRunId]
      );
      const params = result.rows[0]?.strategy_snapshot;
      expect(params).toHaveProperty("ma_period");
      expect(params).toHaveProperty("rsi_period");
      expect(result.rows[0]?.execution_options).toHaveProperty("initial_capital");
    });
  });

  describe("Run References", () => {
    it("run references strategy version via FK", async () => {
      const result = await query(
        `SELECT strategy_version_id, dataset_snapshot_id FROM backtest_runs WHERE id = $1`,
        [testRunId]
      );
      expect(result.rows[0]?.strategy_version_id).toBe(testStrategyVersionId);
      expect(result.rows[0]?.dataset_snapshot_id).toBe(testDatasetSnapshotId);
    });
  });

  describe("Metrics Normalization", () => {
    it("metrics are stored with standardized names", async () => {
      await query(
        `INSERT INTO backtest_metrics (run_id, metric_key, metric_value, metric_group, created_at)
         VALUES ($1, 'total_return', 15.5, 'returns', $2)`,
        [testRunId, new Date().toISOString()]
      );
      const result = await query(
        `SELECT metric_key, metric_value, metric_group FROM backtest_metrics WHERE run_id = $1`,
        [testRunId]
      );
      expect(result.rows[0]?.metric_key).toBe("total_return");
      expect(result.rows[0]?.metric_group).toBe("returns");
    });
  });

  describe("Events Append-Only", () => {
    it("events are auditable with trace context", async () => {
      const eventId = `event-${Date.now()}`;
      await query(
        `INSERT INTO backtest_events (id, run_id, event_type, payload, trace_id, span_id, parent_span_id, correlation_id, created_at)
         VALUES ($1, $2, 'run_started', $3, 'trace-event', 'span-event', 'parent-event', 'corr-event', $4)`,
        [eventId, testRunId, JSON.stringify({ status: "started" }), new Date().toISOString()]
      );
      const result = await query(
        `SELECT event_type, trace_id, parent_span_id FROM backtest_events WHERE id = $1`,
        [eventId]
      );
      expect(result.rows[0]?.event_type).toBe("run_started");
      expect(result.rows[0]?.trace_id).toBe("trace-event");
    });
  });
});
