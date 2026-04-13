import { Effect } from "effect";
import { getMcpDependencies } from "../../server";

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
  execute: (input: { run_id: string }) => {
    const deps = getMcpDependencies();
    return deps.backtestServices.getRunSummary(input.run_id).pipe(
      Effect.map((s) => ({
        run_id: s.run.id,
        status: s.run.status,
        metrics: s.metrics.map((m: any) => ({
          key: m.metric_key,
          value: m.metric_value,
          group: m.metric_group,
        })),
        event_count: s.eventCount,
      }))
    );
  },
};
