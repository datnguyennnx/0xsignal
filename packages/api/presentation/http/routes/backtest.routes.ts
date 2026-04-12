/** Backtest Routes - /api/backtests */

import type { BacktestServices } from "../../../application/backtest";
import type { Context } from "effect";

type BacktestService = Context.Tag.Service<typeof BacktestServices>;

export const makeBacktestRoutes = (services: BacktestService) => ({
  createRun: (body: {
    strategy_version_id: string;
    dataset_snapshot_id: string;
    session_id?: string;
    initial_capital?: number;
    base_currency?: string;
    engine_version?: string;
    created_by_action_id?: string;
  }) =>
    services.createBacktestRun({
      id: crypto.randomUUID(),
      strategy_version_id: body.strategy_version_id,
      dataset_snapshot_id: body.dataset_snapshot_id,
      session_id: body.session_id,
      status: "pending",
      engine_version: body.engine_version ?? "1.0",
      run_mode: "backtest",
      initial_capital: body.initial_capital ?? 10000,
      base_currency: body.base_currency ?? "USD",
      created_by_action_id: body.created_by_action_id,
    }),

  getRunSummary: (id: string) => services.getRunSummary(id),

  appendEvent: (body: {
    run_id: string;
    event_type: string;
    payload?: unknown;
    level: "debug" | "info" | "warn" | "error";
  }) =>
    services.appendRunEvent({
      id: crypto.randomUUID(),
      run_id: body.run_id,
      event_type: body.event_type as any,
      payload: body.payload,
      level: body.level,
    }),

  recordMetric: (body: {
    run_id: string;
    metric_key: string;
    metric_value: number;
    metric_group: string;
  }) =>
    services.recordMetric({
      run_id: body.run_id,
      metric_key: body.metric_key,
      metric_value: body.metric_value,
      metric_group: body.metric_group,
    }),
});

export type BacktestRoutes = ReturnType<typeof makeBacktestRoutes>;
