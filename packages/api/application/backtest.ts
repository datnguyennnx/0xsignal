import { Effect } from "effect";
import { validationError, notFoundError, DomainError } from "./errors";
import type {
  BacktestRun,
  BacktestMetric,
  BacktestEvent,
  RunSummary,
  BacktestRunInput as BacktestRunInputs,
} from "../schemas/backtest";
import type { BacktestRepository } from "../infrastructure/repositories/backtest-repo";
import { getRunSummary as fetchRunSummary } from "../infrastructure/repositories/backtest-repo";
import { createBacktestWorker } from "../infrastructure/workers/backtest.worker";
import type { EngineOutput } from "../domain/backtest/engine";

type CreateBacktestRunInput = {
  id: string;
  session_id?: string;
  strategy_version_id: string;
  dataset_snapshot_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  engine_version: string;
  run_mode: "backtest" | "paper" | "live";
  initial_capital: number;
  base_currency: string;
  created_by_action_id?: string;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

type SaveRunInputInput = {
  run_id: string;
  strategy_snapshot: string | unknown;
  dataset_snapshot_ref: string | unknown;
  execution_options?: string | unknown;
  schema_version: string;
};

type AppendRunEventInput = {
  id: string;
  run_id: string;
  event_type:
    | "order_placed"
    | "order_filled"
    | "order_cancelled"
    | "position_opened"
    | "position_closed"
    | "signal"
    | "error"
    | "info";
  payload?: string | unknown;
  level: "debug" | "info" | "warn" | "error";
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
  parent_span_id?: string;
};

type RecordMetricInput = {
  run_id: string;
  metric_key: string;
  metric_value: number;
  metric_group: string;
};

export interface BacktestServices {
  createBacktestRun(input: CreateBacktestRunInput): Effect.Effect<BacktestRun, DomainError, never>;
  saveRunInput(input: SaveRunInputInput): Effect.Effect<BacktestRunInputs, DomainError, never>;
  getRunSummary(id: string): Effect.Effect<RunSummary, DomainError, never>;
  appendRunEvent(input: AppendRunEventInput): Effect.Effect<BacktestEvent, DomainError, never>;
  recordMetric(input: RecordMetricInput): Effect.Effect<BacktestMetric, DomainError, never>;
}

export const makeBacktestService = (repo: BacktestRepository): BacktestServices => ({
  createBacktestRun: (
    input: CreateBacktestRunInput
  ): Effect.Effect<BacktestRun, DomainError, never> =>
    Effect.gen(function* () {
      const run = yield* Effect.tryPromise({
        try: () =>
          repo.insertRun({
            id: input.id,
            session_id: input.session_id,
            strategy_version_id: input.strategy_version_id,
            dataset_snapshot_id: input.dataset_snapshot_id,
            status: input.status,
            engine_version: input.engine_version,
            run_mode: input.run_mode,
            initial_capital: input.initial_capital,
            base_currency: input.base_currency,
            created_by_action_id: input.created_by_action_id,
            trace_id: input.trace_id,
            span_id: input.span_id,
            correlation_id: input.correlation_id,
            started_at: new Date().toISOString(),
          }),
        catch: (e) => validationError("Failed to create backtest run", e),
      });

      const worker = createBacktestWorker({
        repo,
        runEngine: async (engineInput): Promise<EngineOutput> => {
          // Minimal viable engine stub to prove lifecycle execution
          return {
            status: "completed",
            metrics: {
              total_return: 1.5,
              total_trades: 10,
              run_duration_ms: 50,
              bars_processed: 100,
            },
            events: [
              {
                timestamp: new Date().toISOString(),
                event_type: "info",
                level: "info",
                payload: { action: "Stub engine executed successfully" },
              },
            ],
            artifacts: [],
            run_duration_ms: 50,
            bars_processed: 100,
          };
        },
      });

      // Dispatch the worker asynchronously
      yield* Effect.forkDaemon(
        worker
          .runBacktest({
            runId: run.id,
            strategySnapshotId: run.strategy_version_id,
            datasetSnapshotId: run.dataset_snapshot_id,
          })
          .pipe(Effect.catchAllCause((cause) => Effect.logError("Background worker failed", cause)))
      );

      return run;
    }),

  saveRunInput: (input: SaveRunInputInput): Effect.Effect<BacktestRunInputs, DomainError, never> =>
    Effect.tryPromise({
      try: () =>
        repo.insertRunInput({
          run_id: input.run_id,
          strategy_snapshot: input.strategy_snapshot,
          dataset_snapshot_ref: input.dataset_snapshot_ref,
          execution_options: input.execution_options,
          schema_version: input.schema_version,
          created_at: new Date().toISOString(),
        }),
      catch: (e) => validationError("Failed to save run input", e),
    }),

  getRunSummary: (id: string): Effect.Effect<RunSummary, DomainError, never> =>
    Effect.gen(function* () {
      const summary = yield* Effect.tryPromise({
        try: () => fetchRunSummary(id),
        catch: (e) => validationError("Failed to get run summary", e),
      });
      if (!summary) {
        return yield* Effect.fail(notFoundError(`Run ${id} not found`));
      }
      return summary;
    }),

  appendRunEvent: (input: AppendRunEventInput): Effect.Effect<BacktestEvent, DomainError, never> =>
    Effect.tryPromise({
      try: () =>
        repo.insertEvent({
          id: input.id,
          run_id: input.run_id,
          event_type: input.event_type,
          payload: input.payload,
          level: input.level,
          trace_id: input.trace_id,
          span_id: input.span_id,
          correlation_id: input.correlation_id,
          parent_span_id: input.parent_span_id,
          created_at: new Date().toISOString(),
        }),
      catch: (e) => validationError("Failed to append run event", e),
    }),

  recordMetric: (input: RecordMetricInput): Effect.Effect<BacktestMetric, DomainError, never> =>
    Effect.tryPromise({
      try: () =>
        repo.insertMetric({
          run_id: input.run_id,
          metric_key: input.metric_key,
          metric_value: input.metric_value,
          metric_group: input.metric_group,
          created_at: new Date().toISOString(),
        }),
      catch: (e) => validationError("Failed to record metric", e),
    }),
});
