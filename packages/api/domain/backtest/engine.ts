export type RunLifecycleState = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface StrategySnapshotRef {
  id: string;
}

export interface DatasetSnapshotRef {
  id: string;
}

export interface ExecutionOptions {
  initial_capital: number;
  base_currency: string;
  commission_rate?: number;
  slippage_model?: "fixed" | "volume" | "volatility";
  max_position_size?: number;
  allow_partial_fills?: boolean;
}

export interface EngineInput {
  strategy_snapshot: StrategySnapshotRef;
  dataset_snapshot_ref: DatasetSnapshotRef;
  execution_options: ExecutionOptions;
  schema_version: string;
}

export interface BacktestArtifact {
  artifact_type: "chart" | "report" | "equity_curve" | "trades_log" | "positions" | "config";
  storage_path: string;
  content_type: string;
  size_bytes?: number;
  metadata?: Record<string, unknown>;
}

export interface EngineOutput {
  status: RunLifecycleState;
  metrics: Record<string, number>;
  events: Array<{
    timestamp: string;
    event_type: string;
    payload?: unknown;
    level: "debug" | "info" | "warn" | "error";
  }>;
  artifacts: BacktestArtifact[];
  run_duration_ms: number;
  bars_processed: number;
}

import { Context, Data, Effect } from "effect";

export class EngineError extends Data.TaggedError("EngineError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class EngineExecutor extends Context.Tag("EngineExecutor")<
  EngineExecutor,
  {
    readonly runEngine: (input: EngineInput) => Effect.Effect<EngineOutput, EngineError>;
  }
>() {}
