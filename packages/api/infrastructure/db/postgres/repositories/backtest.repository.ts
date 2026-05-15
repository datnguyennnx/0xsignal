import { Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../client";
import type {
  BacktestRun,
  BacktestRunInput as BacktestRunInputs,
  BacktestMetric,
  BacktestEvent,
} from "../../../../schemas/backtest";
import { BacktestRepository } from "../../../../application/ports/backtest-repository";
import { DomainError } from "../../../../application/errors";

const dbError = (method: string, cause: unknown) =>
  new DomainError({
    code: "INTERNAL_ERROR",
    message: `Database error in BacktestRepository.${method}`,
    cause,
  });

export const BacktestRepositoryLive = Layer.effect(
  BacktestRepository,
  Effect.gen(function* () {
    const pool = yield* PostgresConnectionPool;

    return {
      getRun: (id: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM backtest_runs WHERE id = $1`;
            const result = await pool.query(sql, [id]);
            return result.rows[0] as BacktestRun | null;
          },
          catch: (e) => dbError("getRun", e),
        }),

      getRunInput: (runId: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM backtest_run_inputs WHERE run_id = $1`;
            const result = await pool.query(sql, [runId]);
            return (result.rows[0] as BacktestRunInputs) ?? null;
          },
          catch: (e) => dbError("getRunInput", e),
        }),

      createRunWithInput: (run: BacktestRun, input: BacktestRunInputs) =>
        Effect.tryPromise({
          try: async () => {
            const client = await pool.connect();
            try {
              await client.query("BEGIN");

              const runSql = `
          INSERT INTO backtest_runs (id, session_id, strategy_version_id, dataset_snapshot_id, status, engine_version, run_mode, initial_capital, base_currency, created_by_action_id, trace_id, span_id, correlation_id, started_at, finished_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING *
        `;
              const runResult = await client.query(runSql, [
                run.id,
                run.session_id,
                run.strategy_version_id,
                run.dataset_snapshot_id,
                run.status,
                run.engine_version,
                run.run_mode,
                run.initial_capital,
                run.base_currency,
                run.created_by_action_id,
                run.trace_id,
                run.span_id,
                run.correlation_id,
                run.started_at,
                run.finished_at,
              ]);

              const inputSql = `
          INSERT INTO backtest_run_inputs (run_id, strategy_snapshot, dataset_snapshot_ref, execution_options, schema_version, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

              await client.query(inputSql, [
                input.run_id,
                typeof input.strategy_snapshot === "string"
                  ? input.strategy_snapshot
                  : JSON.stringify(input.strategy_snapshot),
                typeof input.dataset_snapshot_ref === "string"
                  ? input.dataset_snapshot_ref
                  : JSON.stringify(input.dataset_snapshot_ref),
                input.execution_options
                  ? typeof input.execution_options === "string"
                    ? input.execution_options
                    : JSON.stringify(input.execution_options)
                  : null,
                input.schema_version,
                input.created_at,
              ]);

              await client.query("COMMIT");
              return runResult.rows[0] as BacktestRun;
            } catch (error) {
              await client.query("ROLLBACK");
              throw error;
            } finally {
              client.release();
            }
          },
          catch: (e) => dbError("createRunWithInput", e),
        }),

      insertRunInput: (input: BacktestRunInputs) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO backtest_run_inputs (run_id, strategy_snapshot, dataset_snapshot_ref, execution_options, schema_version, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
            const result = await pool.query(sql, [
              input.run_id,
              typeof input.strategy_snapshot === "string"
                ? input.strategy_snapshot
                : JSON.stringify(input.strategy_snapshot),
              typeof input.dataset_snapshot_ref === "string"
                ? input.dataset_snapshot_ref
                : JSON.stringify(input.dataset_snapshot_ref),
              input.execution_options
                ? typeof input.execution_options === "string"
                  ? input.execution_options
                  : JSON.stringify(input.execution_options)
                : null,
              input.schema_version,
              input.created_at,
            ]);
            return result.rows[0] as BacktestRunInputs;
          },
          catch: (e) => dbError("insertRunInput", e),
        }),

      insertMetric: (metric: BacktestMetric) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO backtest_metrics (run_id, metric_key, metric_value, metric_group, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
            const result = await pool.query(sql, [
              metric.run_id,
              metric.metric_key,
              metric.metric_value,
              metric.metric_group,
              metric.created_at,
            ]);
            return result.rows[0] as BacktestMetric;
          },
          catch: (e) => dbError("insertMetric", e),
        }),

      getMetricsByRun: (runId: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM backtest_metrics WHERE run_id = $1 ORDER BY created_at`;
            const result = await pool.query(sql, [runId]);
            return result.rows as BacktestMetric[];
          },
          catch: (e) => dbError("getMetricsByRun", e),
        }),

      insertEvent: (event: BacktestEvent) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO backtest_events (id, run_id, event_type, payload, level, trace_id, span_id, correlation_id, parent_span_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
            const result = await pool.query(sql, [
              event.id,
              event.run_id,
              event.event_type,
              event.payload ? JSON.stringify(event.payload) : null,
              event.level,
              event.trace_id,
              event.span_id,
              event.correlation_id,
              event.parent_span_id,
              event.created_at,
            ]);
            return result.rows[0] as BacktestEvent;
          },
          catch: (e) => dbError("insertEvent", e),
        }),

      getEventsByRun: (runId: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM backtest_events WHERE run_id = $1 ORDER BY created_at`;
            const result = await pool.query(sql, [runId]);
            return result.rows as BacktestEvent[];
          },
          catch: (e) => dbError("getEventsByRun", e),
        }),

      getEventCount: (runId: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT COUNT(*) as count FROM backtest_events WHERE run_id = $1`;
            const result = await pool.query(sql, [runId]);
            return parseInt(result.rows[0]?.count ?? "0", 10);
          },
          catch: (e) => dbError("getEventCount", e),
        }),

      updateRunStatus: (id: string, status: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        UPDATE backtest_runs
        SET status = $2, finished_at = CASE WHEN $2 IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE finished_at END
        WHERE id = $1
        RETURNING *
      `;
            const result = await pool.query(sql, [id, status]);
            return (result.rows[0] as BacktestRun) ?? null;
          },
          catch: (e) => dbError("updateRunStatus", e),
        }),
    };
  })
);
