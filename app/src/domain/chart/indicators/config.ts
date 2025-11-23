import type { IndicatorConfig } from "./types";

// Re-export types for convenience
export type { IndicatorConfig, ActiveIndicator, IndicatorCategory } from "./types";

export const AVAILABLE_INDICATORS: IndicatorConfig[] = [
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
