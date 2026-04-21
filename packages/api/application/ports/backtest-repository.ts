import type {
  BacktestEvent,
  BacktestMetric,
  BacktestRun,
  BacktestRunInput as BacktestRunInputs,
} from "@schemas/backtest";

export interface BacktestRepository {
  insertRun(run: BacktestRun): Promise<BacktestRun>;
  createRunWithInput(run: BacktestRun, input: BacktestRunInputs): Promise<BacktestRun>;
  getRun(id: string): Promise<BacktestRun | null>;
  insertRunInput(input: BacktestRunInputs): Promise<BacktestRunInputs>;
  getRunInput(runId: string): Promise<BacktestRunInputs | null>;
  insertMetric(metric: BacktestMetric): Promise<BacktestMetric>;
  getMetricsByRun(runId: string): Promise<BacktestMetric[]>;
  insertEvent(event: BacktestEvent): Promise<BacktestEvent>;
  getEventsByRun(runId: string): Promise<BacktestEvent[]>;
  getEventCount(runId: string): Promise<number>;
  updateRunStatus(id: string, status: string): Promise<BacktestRun | null>;
}
