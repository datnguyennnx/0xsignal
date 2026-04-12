import { Effect } from "effect";
import { validationError, DomainError } from "../../application/errors";
import type { BacktestMetric, BacktestEvent } from "../../schemas/backtest";
import type { BacktestRepository } from "../repositories/backtest-repo";
import type { EngineInput, EngineOutput } from "../../domain/backtest/engine";

interface WorkerConfig {
  runId: string;
  strategySnapshotId: string;
  datasetSnapshotId: string;
}

interface BacktestWorkerDependencies {
  repo: BacktestRepository;
  runEngine: (input: EngineInput) => Promise<EngineOutput>;
}

export const createBacktestWorker = (deps: BacktestWorkerDependencies) => {
  const runBacktest = (config: WorkerConfig): Effect.Effect<EngineOutput, DomainError, never> =>
    Effect.gen(function* () {
      const run = yield* Effect.tryPromise({
        try: () => deps.repo.getRun(config.runId),
        catch: (e) => validationError("Failed to get run", e),
      });

      if (!run) {
        return yield* Effect.fail(validationError(`Run ${config.runId} not found`));
      }

      // Transition to running state
      yield* Effect.tryPromise({
        try: () => deps.repo.updateRunStatus(config.runId, "running"),
        catch: (e) => validationError("Failed to update status to running", e),
      });

      yield* Effect.tryPromise({
        try: () =>
          deps.repo.insertEvent({
            id: crypto.randomUUID(),
            run_id: config.runId,
            event_type: "info",
            payload: { message: "Starting backtest execution" },
            level: "info",
            created_at: new Date().toISOString(),
          }),
        catch: (e) => validationError("Failed to emit start event", e),
      });

      const engineInput: EngineInput = {
        strategy_snapshot: { id: config.strategySnapshotId },
        dataset_snapshot_ref: { id: config.datasetSnapshotId },
        execution_options: {
          initial_capital: run.initial_capital,
          base_currency: run.base_currency,
        },
        schema_version: "1.0",
      };

      const result = yield* Effect.tryPromise({
        try: async () => {
          const output = await deps.runEngine(engineInput);

          const metricPromises: Promise<BacktestMetric>[] = [];
          for (const [key, value] of Object.entries(output.metrics)) {
            const metric: BacktestMetric = {
              run_id: config.runId,
              metric_key: key,
              metric_value: value,
              metric_group:
                key in
                {
                  total_return: "returns",
                  annual_return: "returns",
                  sharpe_ratio: "risk_adjusted",
                  sortino_ratio: "risk_adjusted",
                  max_drawdown: "drawdown",
                  avg_drawdown: "drawdown",
                  drawdown_duration: "drawdown",
                  total_trades: "trade_statistics",
                  win_rate: "trade_statistics",
                  profit_factor: "trade_statistics",
                  avg_trade: "trade_statistics",
                  calmar_ratio: "risk_adjusted",
                  omega_ratio: "risk_adjusted",
                  time_in_market: "exposure",
                  avg_position_size: "exposure",
                  run_duration_ms: "duration",
                  bars_counted: "duration",
                }
                  ? ({
                      total_return: "returns",
                      annual_return: "returns",
                      sharpe_ratio: "risk_adjusted",
                      sortino_ratio: "risk_adjusted",
                      max_drawdown: "drawdown",
                      avg_drawdown: "drawdown",
                      drawdown_duration: "drawdown",
                      total_trades: "trade_statistics",
                      win_rate: "trade_statistics",
                      profit_factor: "trade_statistics",
                      avg_trade: "trade_statistics",
                      calmar_ratio: "risk_adjusted",
                      omega_ratio: "risk_adjusted",
                      time_in_market: "exposure",
                      avg_position_size: "exposure",
                      run_duration_ms: "duration",
                      bars_counted: "duration",
                    }[key] ?? "duration")
                  : "duration",
              created_at: new Date().toISOString(),
            };
            metricPromises.push(deps.repo.insertMetric(metric));
          }
          await Promise.all(metricPromises);

          const eventPromises: Promise<BacktestEvent>[] = [];
          for (const event of output.events) {
            eventPromises.push(
              deps.repo.insertEvent({
                id: crypto.randomUUID(),
                run_id: config.runId,
                event_type: event.event_type as any,
                payload: event.payload,
                level: event.level,
                created_at: event.timestamp,
              })
            );
          }
          await Promise.all(eventPromises);

          return output;
        },
        catch: (e) => validationError("Engine execution failed", e),
      });

      yield* Effect.tryPromise({
        try: () =>
          deps.repo.insertEvent({
            id: crypto.randomUUID(),
            run_id: config.runId,
            event_type: "info",
            payload: {
              message: `Backtest completed with status: ${result.status}`,
              metrics: Object.keys(result.metrics),
              artifacts: result.artifacts.length,
            },
            level: "info",
            created_at: new Date().toISOString(),
          }),
        catch: (e) => validationError("Failed to emit completion event", e),
      });

      // Update final status
      yield* Effect.tryPromise({
        try: () => deps.repo.updateRunStatus(config.runId, result.status),
        catch: (e) => validationError("Failed to update final status", e),
      });

      return result;
    });

  return { runBacktest };
};

export type BacktestWorker = ReturnType<typeof createBacktestWorker>;
