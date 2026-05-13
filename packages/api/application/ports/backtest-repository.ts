import { Context, Effect } from "effect";
import type {
  BacktestEvent,
  BacktestMetric,
  BacktestRun,
  BacktestRunInput as BacktestRunInputs,
} from "../../schemas/backtest";
import { DomainError } from "../errors";

export interface BacktestRepository {
  readonly createRunWithInput: (
    run: BacktestRun,
    input: BacktestRunInputs
  ) => Effect.Effect<BacktestRun, DomainError>;
  readonly getRun: (id: string) => Effect.Effect<BacktestRun | null, DomainError>;
  readonly getRunInput: (runId: string) => Effect.Effect<BacktestRunInputs | null, DomainError>;
  readonly insertRunInput: (
    input: BacktestRunInputs
  ) => Effect.Effect<BacktestRunInputs, DomainError>;
  readonly insertMetric: (metric: BacktestMetric) => Effect.Effect<BacktestMetric, DomainError>;
  readonly getMetricsByRun: (runId: string) => Effect.Effect<BacktestMetric[], DomainError>;
  readonly insertEvent: (event: BacktestEvent) => Effect.Effect<BacktestEvent, DomainError>;
  readonly getEventsByRun: (runId: string) => Effect.Effect<BacktestEvent[], DomainError>;
  readonly getEventCount: (runId: string) => Effect.Effect<number, DomainError>;
  readonly updateRunStatus: (
    id: string,
    status: string
  ) => Effect.Effect<BacktestRun | null, DomainError>;
}

export const BacktestRepository = Context.GenericTag<BacktestRepository>(
  "@services/BacktestRepository"
);
