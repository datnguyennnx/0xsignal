import { Effect } from "effect";
import { BacktestServices } from "../../../../application/backtest/service";

export const startBacktestRunTool = {
  name: "start_backtest_run",
  description: "Start a new backtest run with a strategy version and dataset snapshot",
  execute: (input: {
    strategy_version_id: string;
    dataset_snapshot_id: string;
    session_id?: string;
    initial_capital?: number;
    base_currency?: string;
    engine_version?: string;
    created_by_action_id?: string;
  }) =>
    Effect.gen(function* () {
      const services = yield* BacktestServices;
      const run = yield* services.createBacktestRun({
        id: crypto.randomUUID(),
        strategy_version_id: input.strategy_version_id,
        dataset_snapshot_id: input.dataset_snapshot_id,
        session_id: input.session_id,
        status: "queued",
        engine_version: input.engine_version ?? "1.0",
        run_mode: "backtest",
        initial_capital: input.initial_capital ?? 10000,
        base_currency: input.base_currency ?? "USD",
        created_by_action_id: input.created_by_action_id,
      });
      return { run_id: run.id, status: run.status };
    }),
  inputSchema: {
    type: "object",
    properties: {
      strategy_version_id: { type: "string" },
      dataset_snapshot_id: { type: "string" },
      session_id: { type: "string" },
      initial_capital: { type: "number" },
      base_currency: { type: "string" },
      engine_version: { type: "string" },
    },
    required: ["strategy_version_id", "dataset_snapshot_id"],
  },
};
