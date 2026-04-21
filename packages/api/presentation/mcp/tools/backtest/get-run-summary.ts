import { Effect } from "effect";
import { BacktestServices } from "../../../../application/backtest/service";

type SummaryMetric = {
  readonly metric_key: string;
  readonly metric_value: number;
  readonly metric_group: string;
};

export const getRunSummaryTool = {
  name: "get_run_summary",
  description: "Get the summary of a backtest run including metrics and events",
  inputSchema: {
    type: "object",
    properties: {
      run_id: { type: "string" },
    },
    required: ["run_id"],
  },
  execute: (input: { run_id: string }) =>
    Effect.gen(function* () {
      const services = yield* BacktestServices;
      return yield* services.getRunSummary(input.run_id).pipe(
        Effect.map((s) => ({
          run_id: s.run.id,
          status: s.run.status,
          metrics: s.metrics.map((m: SummaryMetric) => ({
            key: m.metric_key,
            value: m.metric_value,
            group: m.metric_group,
          })),
          event_count: s.eventCount,
        }))
      );
    }),
};
