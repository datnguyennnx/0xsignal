import type { StrategyVersion } from "../../schemas/strategy";
import type { DatasetSnapshot } from "../../schemas/market-data";

export type RunLifecycleState = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface ExecutionOptions {
  initial_capital: number;
  base_currency: string;
  commission_rate?: number;
  slippage_model?: "fixed" | "volume" | "volatility";
  max_position_size?: number;
  allow_partial_fills?: boolean;
}

export interface EngineInput {
  strategy_snapshot: StrategyVersion;
  dataset_snapshot_ref: DatasetSnapshot;
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
