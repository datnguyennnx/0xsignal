import { Effect } from "effect";
import { BacktestServices } from "../../../../application/backtest/service";

type SummaryMetric = {
  readonly metric_key: string;
  readonly metric_value: number;
  readonly metric_group: string;
};

export interface RunSummaryResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const runSummaryResource = (runId: string): RunSummaryResource => ({
  uri: `backtest://${runId}/summary`,
  name: "Run Summary",
  description: `Metrics and events for run ${runId}`,
  mimeType: "application/json",
});

export const getRunSummaryResource = (runId: string) => {
  return Effect.flatMap(BacktestServices, (services) => services.getRunSummary(runId)).pipe(
    Effect.map((s) => ({
      resource: runSummaryResource(runId),
      content: JSON.stringify({
        run: {
          id: s.run.id,
          status: s.run.status,
          strategy_version_id: s.run.strategy_version_id,
          dataset_snapshot_id: s.run.dataset_snapshot_id,
          initial_capital: s.run.initial_capital,
          base_currency: s.run.base_currency,
          started_at: s.run.started_at,
          finished_at: s.run.finished_at,
        },
        metrics: s.metrics.map((m: SummaryMetric) => ({
          key: m.metric_key,
          value: m.metric_value,
          group: m.metric_group,
        })),
        event_count: s.eventCount,
      }),
    }))
  );
};
