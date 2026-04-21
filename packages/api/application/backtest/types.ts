export type CreateBacktestRunInput = {
  id: string;
  session_id?: string;
  strategy_version_id: string;
  dataset_snapshot_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  engine_version: string;
  run_mode: "backtest" | "paper" | "live";
  initial_capital: number;
  base_currency: string;
  created_by_action_id?: string;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

export type SaveRunInputInput = {
  run_id: string;
  strategy_snapshot: string | unknown;
  dataset_snapshot_ref: string | unknown;
  execution_options?: string | unknown;
  schema_version: string;
};

export type AppendRunEventInput = {
  id: string;
  run_id: string;
  event_type:
    | "order_placed"
    | "order_filled"
    | "order_cancelled"
    | "position_opened"
    | "position_closed"
    | "signal"
    | "error"
    | "info";
  payload?: string | unknown;
  level: "debug" | "info" | "warn" | "error";
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
  parent_span_id?: string;
};

export type RecordMetricInput = {
  run_id: string;
  metric_key: string;
  metric_value: number;
  metric_group: string;
};
