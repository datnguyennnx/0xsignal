import { Context } from "effect";
import type {
  BacktestEvent,
  BacktestMetric,
  BacktestRun,
  BacktestRunInput as BacktestRunInputs,
} from "../../schemas/backtest";

export interface BacktestRepository {
  readonly createRunWithInput: (run: BacktestRun, input: BacktestRunInputs) => Promise<BacktestRun>;
  readonly getRun: (id: string) => Promise<BacktestRun | null>;
  readonly getRunInput: (runId: string) => Promise<BacktestRunInputs | null>;
  readonly insertRunInput: (input: BacktestRunInputs) => Promise<BacktestRunInputs>;
  readonly insertMetric: (metric: BacktestMetric) => Promise<BacktestMetric>;
  readonly getMetricsByRun: (runId: string) => Promise<BacktestMetric[]>;
  readonly insertEvent: (event: BacktestEvent) => Promise<BacktestEvent>;
  readonly getEventsByRun: (runId: string) => Promise<BacktestEvent[]>;
  readonly getEventCount: (runId: string) => Promise<number>;
  readonly updateRunStatus: (id: string, status: string) => Promise<BacktestRun | null>;
}

export const BacktestRepository = Context.GenericTag<BacktestRepository>(
  "@services/BacktestRepository"
);
