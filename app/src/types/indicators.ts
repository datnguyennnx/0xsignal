// Indicator types and configurations
export type IndicatorCategory = "trend" | "momentum" | "volatility" | "volume" | "oscillators";

export interface IndicatorConfig {
  id: string;
  name: string;
  category: IndicatorCategory;
  description: string;
  defaultParams?: Record<string, number>;
  overlayOnPrice: boolean; // true = overlay on main chart, false = separate pane
}

export const AVAILABLE_INDICATORS: IndicatorConfig[] = [
  // Trend Indicators (overlay on price - pane 0)
  {
    id: "sma",
    name: "Simple Moving Average",
    category: "trend",
    description: "Average price over a period (customizable)",
    defaultParams: { period: 20 },
    overlayOnPrice: true,
  },
  {
    id: "ema",
    name: "Exponential Moving Average",
    category: "trend",
    description: "Weighted average (customizable period)",
    defaultParams: { period: 20 },
    overlayOnPrice: true,
  },
  {
    id: "vwap",
    name: "VWAP",
    category: "volume",
    description: "Volume weighted average price",
    overlayOnPrice: true,
  },

  // Momentum Indicators (separate panes)
  {
    id: "rsi",
    name: "RSI",
    category: "momentum",
    description: "Relative Strength Index (0-100)",
    defaultParams: { period: 14 },
    overlayOnPrice: false,
  },
  {
    id: "macd",
    name: "MACD",
    category: "momentum",
    description: "Moving Average Convergence Divergence",
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    overlayOnPrice: false,
  },
  {
    id: "stochastic",
    name: "Stochastic",
    category: "momentum",
    description: "Momentum oscillator (0-100)",
    defaultParams: { period: 14, smoothK: 3, smoothD: 3 },
    overlayOnPrice: false,
  },
];

export interface ActiveIndicator {
  config: IndicatorConfig;
  params: Record<string, number>;
  visible: boolean;
  color?: string;
}
