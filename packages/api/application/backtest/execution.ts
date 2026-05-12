import { Effect } from "effect";
import type { BacktestRun } from "../../schemas/backtest";
import { DomainError } from "../errors";
import type { BacktestRepository } from "../ports/backtest-repository";
import type { EngineInput, EngineOutput } from "../../domain/backtest/engine";
import { normalizeEventType } from "./policies";

type EngineExecutorService = {
  readonly runEngine: (input: EngineInput) => Effect.Effect<EngineOutput, unknown>;
};

export const executeBacktestRun = (
  repo: BacktestRepository,
  executor: EngineExecutorService,
  run: BacktestRun
): Effect.Effect<void, DomainError> =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => repo.updateRunStatus(run.id, "running"),
      catch: (e) =>
        new DomainError({
          code: "VALIDATION_ERROR",
          message: "Failed to set run to running",
          cause: e,
        }),
    });

    yield* Effect.tryPromise({
      try: () =>
        repo.insertEvent({
          id: crypto.randomUUID(),
          run_id: run.id,
          event_type: "info",
          payload: { message: "Starting backtest execution" },
          level: "info",
          created_at: new Date().toISOString(),
        }),
      catch: (e) =>
        new DomainError({
          code: "VALIDATION_ERROR",
          message: "Failed to insert start event",
          cause: e,
        }),
    });

    const output = yield* executor
      .runEngine({
        strategy_snapshot: { id: run.strategy_version_id },
        dataset_snapshot_ref: { id: run.dataset_snapshot_id },
        execution_options: {
          initial_capital: run.initial_capital,
          base_currency: run.base_currency,
        },
        schema_version: "1.0.0",
      })
      .pipe(
        Effect.mapError(
          (error) =>
            new DomainError({
              code: "VALIDATION_ERROR",
              message: "Backtest engine execution failed",
              cause: error,
            })
        )
      );

    yield* Effect.forEach(Object.entries(output.metrics), ([metricKey, metricValue]) =>
      Effect.tryPromise({
        try: () =>
          repo.insertMetric({
            run_id: run.id,
            metric_key: metricKey,
            metric_value: metricValue,
            metric_group: "performance",
            created_at: new Date().toISOString(),
          }),
        catch: (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to persist metric",
            cause: e,
          }),
      })
    );

    yield* Effect.forEach(output.events, (event) =>
      Effect.tryPromise({
        try: () =>
          repo.insertEvent({
            id: crypto.randomUUID(),
            run_id: run.id,
            event_type: normalizeEventType(event.event_type),
            payload: event.payload,
            level: event.level,
            created_at: event.timestamp,
          }),
        catch: (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to persist event",
            cause: e,
          }),
      })
    );

    yield* Effect.tryPromise({
      try: () => repo.updateRunStatus(run.id, output.status),
      catch: (e) =>
        new DomainError({
          code: "VALIDATION_ERROR",
          message: "Failed to update final run status",
          cause: e,
        }),
    });

    yield* Effect.tryPromise({
      try: () =>
        repo.insertEvent({
          id: crypto.randomUUID(),
          run_id: run.id,
          event_type: "info",
          payload: { message: `Backtest completed with status: ${output.status}` },
          level: "info",
          created_at: new Date().toISOString(),
        }),
      catch: (e) =>
        new DomainError({
          code: "VALIDATION_ERROR",
          message: "Failed to insert completion event",
          cause: e,
        }),
    });
  }).pipe(
    Effect.catchAll((err: DomainError) => {
      const errorMessage = err.message;
      return Effect.tryPromise({
        try: async () => {
          await repo.updateRunStatus(run.id, "failed");
          await repo.insertEvent({
            id: crypto.randomUUID(),
            run_id: run.id,
            event_type: "error",
            payload: { message: errorMessage },
            level: "error",
            created_at: new Date().toISOString(),
          });
        },
        catch: () => err,
      }).pipe(Effect.zipRight(Effect.logError(`Engine execution failed: ${errorMessage}`)));
    })
  );
