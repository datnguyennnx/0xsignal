import { Effect, Context, Layer } from "effect";
import { DomainError } from "../errors";
import type {
  BacktestRun,
  BacktestMetric,
  BacktestEvent,
  RunSummary,
  BacktestRunInput as BacktestRunInputs,
} from "../../schemas/backtest";
import { BacktestRepository } from "../ports/backtest-repository";
import { EngineExecutor } from "../../domain/backtest/engine";
import type {
  CreateBacktestRunInput,
  SaveRunInput,
  AppendRunEventInput,
  RecordMetricInput,
} from "./types";
import { executeBacktestRun } from "./execution";

export class BacktestServices extends Context.Tag("BacktestServices")<
  BacktestServices,
  {
    readonly createBacktestRun: (
      input: CreateBacktestRunInput
    ) => Effect.Effect<BacktestRun, DomainError>;
    readonly saveRunInput: (input: SaveRunInput) => Effect.Effect<BacktestRunInputs, DomainError>;
    readonly getRunSummary: (id: string) => Effect.Effect<RunSummary, DomainError>;
    readonly getRunInput: (id: string) => Effect.Effect<BacktestRunInputs, DomainError>;
    readonly getRunEvents: (id: string) => Effect.Effect<BacktestEvent[], DomainError>;
    readonly appendRunEvent: (
      input: AppendRunEventInput
    ) => Effect.Effect<BacktestEvent, DomainError>;
    readonly recordMetric: (input: RecordMetricInput) => Effect.Effect<BacktestMetric, DomainError>;
  }
>() {}

export const makeBacktestService = (repo: BacktestRepository) =>
  Effect.gen(function* () {
    const executor = yield* EngineExecutor;

    return BacktestServices.of({
      createBacktestRun: (input: CreateBacktestRunInput) =>
        Effect.gen(function* () {
          const run = yield* repo
            .createRunWithInput(
              {
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
              },
              {
                run_id: input.id,
                strategy_snapshot: { id: input.strategy_version_id },
                dataset_snapshot_ref: { id: input.dataset_snapshot_id },
                execution_options: {
                  initial_capital: input.initial_capital,
                  base_currency: input.base_currency,
                  run_mode: input.run_mode,
                  engine_version: input.engine_version,
                },
                schema_version: "1.0.0",
                created_at: new Date().toISOString(),
              }
            )
            .pipe(
              Effect.mapError(
                (e) =>
                  new DomainError({
                    code: "VALIDATION_ERROR",
                    message: "Failed to create backtest run",
                    cause: e,
                  })
              )
            );

          const executeRun = executeBacktestRun(repo, executor, run);

          yield* Effect.forkDaemon(executeRun);
          return run;
        }),

      saveRunInput: (input: SaveRunInput): Effect.Effect<BacktestRunInputs, DomainError> =>
        repo
          .insertRunInput({
            run_id: input.run_id,
            strategy_snapshot: input.strategy_snapshot,
            dataset_snapshot_ref: input.dataset_snapshot_ref,
            execution_options: input.execution_options,
            schema_version: input.schema_version,
            created_at: new Date().toISOString(),
          })
          .pipe(
            Effect.mapError(
              (e) =>
                new DomainError({
                  code: "VALIDATION_ERROR",
                  message: "Failed to save run input",
                  cause: e,
                })
            )
          ),

      getRunSummary: (id: string): Effect.Effect<RunSummary, DomainError> =>
        Effect.gen(function* () {
          const run = yield* repo.getRun(id).pipe(
            Effect.mapError(
              (e) =>
                new DomainError({
                  code: "VALIDATION_ERROR",
                  message: "Failed to load backtest run",
                  cause: e,
                })
            )
          );

          if (!run) {
            return yield* Effect.fail(
              new DomainError({ code: "NOT_FOUND", message: `Run ${id} not found` })
            );
          }

          const metrics = yield* repo.getMetricsByRun(id).pipe(
            Effect.mapError(
              (e) =>
                new DomainError({
                  code: "VALIDATION_ERROR",
                  message: "Failed to load backtest run summary",
                  cause: e,
                })
            )
          );
          const eventCount = yield* repo.getEventCount(id).pipe(
            Effect.mapError(
              (e) =>
                new DomainError({
                  code: "VALIDATION_ERROR",
                  message: "Failed to load backtest run summary",
                  cause: e,
                })
            )
          );

          return { run, metrics, eventCount };
        }),

      getRunInput: (id: string): Effect.Effect<BacktestRunInputs, DomainError> =>
        Effect.gen(function* () {
          const input = yield* repo.getRunInput(id).pipe(
            Effect.mapError(
              (e) =>
                new DomainError({
                  code: "VALIDATION_ERROR",
                  message: "Failed to load backtest run input",
                  cause: e,
                })
            )
          );

          if (!input) {
            return yield* Effect.fail(
              new DomainError({ code: "NOT_FOUND", message: `Input for run ${id} not found` })
            );
          }

          return input;
        }),

      getRunEvents: (id: string): Effect.Effect<BacktestEvent[], DomainError> =>
        repo.getEventsByRun(id).pipe(
          Effect.mapError(
            (e) =>
              new DomainError({
                code: "VALIDATION_ERROR",
                message: "Failed to load backtest run events",
                cause: e,
              })
          )
        ),

      appendRunEvent: (input: AppendRunEventInput): Effect.Effect<BacktestEvent, DomainError> =>
        repo
          .insertEvent({
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
          })
          .pipe(
            Effect.mapError(
              (e) =>
                new DomainError({
                  code: "VALIDATION_ERROR",
                  message: "Failed to append run event",
                  cause: e,
                })
            )
          ),

      recordMetric: (input: RecordMetricInput): Effect.Effect<BacktestMetric, DomainError> =>
        repo
          .insertMetric({
            run_id: input.run_id,
            metric_key: input.metric_key,
            metric_value: input.metric_value,
            metric_group: input.metric_group,
            created_at: new Date().toISOString(),
          })
          .pipe(
            Effect.mapError(
              (e) =>
                new DomainError({
                  code: "VALIDATION_ERROR",
                  message: "Failed to record metric",
                  cause: e,
                })
            )
          ),
    });
  });

export const BacktestServicesLive = Layer.effect(
  BacktestServices,
  Effect.gen(function* () {
    const repo = yield* BacktestRepository;
    return yield* makeBacktestService(repo);
  })
);
