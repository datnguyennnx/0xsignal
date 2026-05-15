import { Clock, Effect } from "effect";
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
    yield* repo.updateRunStatus(run.id, "running").pipe(
      Effect.mapError(
        (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to set run to running",
            cause: e,
          })
      )
    );

    yield* repo
      .insertEvent({
        id: yield* Effect.sync(() => crypto.randomUUID()),
        run_id: run.id,
        event_type: "info",
        payload: { message: "Starting backtest execution" },
        level: "info",
        created_at: new Date(yield* Clock.currentTimeMillis).toISOString(),
      })
      .pipe(
        Effect.mapError(
          (e) =>
            new DomainError({
              code: "VALIDATION_ERROR",
              message: "Failed to insert start event",
              cause: e,
            })
        )
      );

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

    yield* Effect.forEach(
      Object.entries(output.metrics),
      ([metricKey, metricValue]) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          return yield* repo
            .insertMetric({
              run_id: run.id,
              metric_key: metricKey,
              metric_value: metricValue,
              metric_group: "performance",
              created_at: new Date(now).toISOString(),
            })
            .pipe(
              Effect.mapError(
                (e) =>
                  new DomainError({
                    code: "VALIDATION_ERROR",
                    message: "Failed to persist metric",
                    cause: e,
                  })
              )
            );
        }),
      { concurrency: 10 }
    );

    yield* Effect.forEach(
      output.events,
      (event) =>
        Effect.gen(function* () {
          const id = yield* Effect.sync(() => crypto.randomUUID());
          return yield* repo
            .insertEvent({
              id,
              run_id: run.id,
              event_type: normalizeEventType(event.event_type),
              payload: event.payload,
              level: event.level,
              created_at: event.timestamp,
            })
            .pipe(
              Effect.mapError(
                (e) =>
                  new DomainError({
                    code: "VALIDATION_ERROR",
                    message: "Failed to persist event",
                    cause: e,
                  })
              )
            );
        }),
      { concurrency: 10 }
    );

    yield* repo.updateRunStatus(run.id, output.status).pipe(
      Effect.mapError(
        (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to update final run status",
            cause: e,
          })
      )
    );

    yield* repo
      .insertEvent({
        id: yield* Effect.sync(() => crypto.randomUUID()),
        run_id: run.id,
        event_type: "info",
        payload: { message: `Backtest completed with status: ${output.status}` },
        level: "info",
        created_at: new Date(yield* Clock.currentTimeMillis).toISOString(),
      })
      .pipe(
        Effect.mapError(
          (e) =>
            new DomainError({
              code: "VALIDATION_ERROR",
              message: "Failed to insert completion event",
              cause: e,
            })
        )
      );
  }).pipe(
    Effect.catchAll((err: DomainError) =>
      Effect.gen(function* () {
        yield* repo
          .updateRunStatus(run.id, "failed")
          .pipe(Effect.catchAll((e) => Effect.logWarning("Failed to set run to failed", e)));
        yield* repo
          .insertEvent({
            id: yield* Effect.sync(() => crypto.randomUUID()),
            run_id: run.id,
            event_type: "error",
            payload: { message: err.message },
            level: "error",
            created_at: new Date(yield* Clock.currentTimeMillis).toISOString(),
          })
          .pipe(Effect.catchAll((e) => Effect.logWarning("Failed to insert error event", e)));
        yield* Effect.logError(`Engine execution failed: ${err.message}`);
      })
    )
  );
