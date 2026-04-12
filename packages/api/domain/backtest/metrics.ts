export type MetricGroup =
  | "returns"
  | "drawdown"
  | "trade_statistics"
  | "risk_adjusted"
  | "exposure"
  | "duration";

export interface MetricDefinition {
  key: string;
  group: MetricGroup;
  description: string;
  format?: "percentage" | "currency" | "ratio" | "number";
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  total_return: {
    key: "total_return",
    group: "returns",
    description: "Total percentage return over the backtest period",
    format: "percentage",
  },
  annual_return: {
    key: "annual_return",
    group: "returns",
    description: "Annualized return percentage",
    format: "percentage",
  },
  sharpe_ratio: {
    key: "sharpe_ratio",
    group: "risk_adjusted",
    description: "Risk-adjusted return using standard deviation",
    format: "ratio",
  },
  sortino_ratio: {
    key: "sortino_ratio",
    group: "risk_adjusted",
    description: "Risk-adjusted return using downside deviation",
    format: "ratio",
  },
  max_drawdown: {
    key: "max_drawdown",
    group: "drawdown",
    description: "Maximum peak-to-trough decline",
    format: "percentage",
  },
  avg_drawdown: {
    key: "avg_drawdown",
    group: "drawdown",
    description: "Average drawdown magnitude",
    format: "percentage",
  },
  drawdown_duration: {
    key: "drawdown_duration",
    group: "drawdown",
    description: "Average duration of drawdown periods in bars",
    format: "number",
  },
  total_trades: {
    key: "total_trades",
    group: "trade_statistics",
    description: "Total number of completed trades",
    format: "number",
  },
  win_rate: {
    key: "win_rate",
    group: "trade_statistics",
    description: "Percentage of profitable trades",
    format: "percentage",
  },
  profit_factor: {
    key: "profit_factor",
    group: "trade_statistics",
    description: "Gross profit divided by gross loss",
    format: "ratio",
  },
  avg_trade: {
    key: "avg_trade",
    group: "trade_statistics",
    description: "Average profit/loss per trade",
    format: "currency",
  },
  calmar_ratio: {
    key: "calmar_ratio",
    group: "risk_adjusted",
    description: "Annual return divided by max drawdown",
    format: "ratio",
  },
  omega_ratio: {
    key: "omega_ratio",
    group: "risk_adjusted",
    description: "Probability-weighted ratio of gains to losses",
    format: "ratio",
  },
  time_in_market: {
    key: "time_in_market",
    group: "exposure",
    description: "Percentage of time with open positions",
    format: "percentage",
  },
  avg_position_size: {
    key: "avg_position_size",
    group: "exposure",
    description: "Average position size as percentage of capital",
    format: "percentage",
  },
  run_duration_ms: {
    key: "run_duration_ms",
    group: "duration",
    description: "Total execution time in milliseconds",
    format: "number",
  },
  bars_counted: {
    key: "bars_counted",
    group: "duration",
    description: "Number of price bars processed",
    format: "number",
  },
};

export const METRIC_GROUPS: Record<MetricGroup, string> = {
  returns: "Returns",
  drawdown: "Drawdown",
  trade_statistics: "Trade Statistics",
  risk_adjusted: "Risk-Adjusted",
  exposure: "Exposure",
  duration: "Duration",
};
