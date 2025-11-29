import type { IndicatorConfig } from "./types";

// Re-export types for convenience
export type { IndicatorConfig, ActiveIndicator, IndicatorCategory } from "./types";

export const AVAILABLE_INDICATORS: IndicatorConfig[] = [
  // ============================================================================
  // TREND INDICATORS (Overlay on price)
  // ============================================================================
  {
    id: "sma",
    name: "SMA",
    category: "trend",
    description: "Simple Moving Average",
    defaultParams: { period: 20 },
    overlayOnPrice: true,
  },
  {
    id: "ema",
    name: "EMA",
    category: "trend",
    description: "Exponential Moving Average",
    defaultParams: { period: 20 },
    overlayOnPrice: true,
  },
  {
    id: "vwma",
    name: "VWMA",
    category: "trend",
    description: "Volume Weighted Moving Average",
    defaultParams: { period: 20 },
    overlayOnPrice: true,
  },
  {
    id: "vwap",
    name: "VWAP",
    category: "volume",
    description: "Volume Weighted Average Price",
    overlayOnPrice: true,
  },
  {
    id: "superTrend",
    name: "SuperTrend",
    category: "trend",
    description: "ATR-based trend indicator",
    defaultParams: { period: 10, multiplier: 3 },
    overlayOnPrice: true,
  },
  {
    id: "parabolicSAR",
    name: "Parabolic SAR",
    category: "trend",
    description: "Stop and reverse points",
    defaultParams: { step: 0.02, maxStep: 0.2 },
    overlayOnPrice: true,
  },

  // ============================================================================
  // VOLATILITY INDICATORS (Bands - Overlay)
  // ============================================================================
  {
    id: "bollingerBands",
    name: "Bollinger Bands",
    category: "volatility",
    description: "SMA ± 2 standard deviations",
    defaultParams: { period: 20, stdDev: 2 },
    overlayOnPrice: true,
  },
  {
    id: "keltnerChannels",
    name: "Keltner Channels",
    category: "volatility",
    description: "EMA ± ATR multiplier",
    defaultParams: { period: 20, multiplier: 2 },
    overlayOnPrice: true,
  },
  {
    id: "donchianChannels",
    name: "Donchian Channels",
    category: "volatility",
    description: "Highest high / lowest low",
    defaultParams: { period: 20 },
    overlayOnPrice: true,
  },

  // ============================================================================
  // MOMENTUM OSCILLATORS (Separate pane)
  // ============================================================================
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
  {
    id: "williamsR",
    name: "Williams %R",
    category: "momentum",
    description: "Momentum oscillator (-100 to 0)",
    defaultParams: { period: 14 },
    overlayOnPrice: false,
  },
  {
    id: "cci",
    name: "CCI",
    category: "momentum",
    description: "Commodity Channel Index",
    defaultParams: { period: 20 },
    overlayOnPrice: false,
  },
  {
    id: "roc",
    name: "ROC",
    category: "momentum",
    description: "Rate of Change (%)",
    defaultParams: { period: 12 },
    overlayOnPrice: false,
  },
  {
    id: "momentum",
    name: "Momentum",
    category: "momentum",
    description: "Price change over n periods",
    defaultParams: { period: 10 },
    overlayOnPrice: false,
  },
  {
    id: "tsi",
    name: "TSI",
    category: "momentum",
    description: "True Strength Index",
    defaultParams: { longPeriod: 25, shortPeriod: 13 },
    overlayOnPrice: false,
  },

  // ============================================================================
  // TREND STRENGTH (Separate pane)
  // ============================================================================
  {
    id: "adx",
    name: "ADX",
    category: "trend",
    description: "Average Directional Index (trend strength)",
    defaultParams: { period: 14 },
    overlayOnPrice: false,
  },

  // ============================================================================
  // VOLATILITY OSCILLATORS (Separate pane)
  // ============================================================================
  {
    id: "atr",
    name: "ATR",
    category: "volatility",
    description: "Average True Range",
    defaultParams: { period: 14 },
    overlayOnPrice: false,
  },

  // ============================================================================
  // VOLUME INDICATORS (Separate pane)
  // ============================================================================
  {
    id: "obv",
    name: "OBV",
    category: "volume",
    description: "On-Balance Volume",
    overlayOnPrice: false,
  },
  {
    id: "mfi",
    name: "MFI",
    category: "volume",
    description: "Money Flow Index (0-100)",
    defaultParams: { period: 14 },
    overlayOnPrice: false,
  },
  {
    id: "cmf",
    name: "CMF",
    category: "volume",
    description: "Chaikin Money Flow (-1 to 1)",
    defaultParams: { period: 20 },
    overlayOnPrice: false,
  },
  {
    id: "adLine",
    name: "A/D Line",
    category: "volume",
    description: "Accumulation/Distribution Line",
    overlayOnPrice: false,
  },
];
