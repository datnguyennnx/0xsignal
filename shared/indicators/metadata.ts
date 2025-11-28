/**
 * Indicator metadata - presets, formulas, interpretations
 * Shared between frontend components
 */

/** Quick period presets per indicator */
export const INDICATOR_PRESETS: Record<string, readonly number[]> = {
  sma: [9, 20, 50, 200],
  ema: [9, 12, 26, 50],
  vwma: [10, 20, 50],
  rsi: [7, 14, 21],
  stochastic: [5, 14, 21],
  williamsR: [7, 14, 21],
  cci: [14, 20, 50],
  roc: [9, 12, 25],
  momentum: [10, 14, 21],
  atr: [7, 14, 21],
  adx: [7, 14, 21],
  mfi: [7, 14, 21],
  cmf: [10, 20, 21],
  bollingerBands: [10, 20, 50],
  keltnerChannels: [10, 20, 50],
  donchianChannels: [10, 20, 55],
  superTrend: [7, 10, 14],
} as const;

/** Indicator formula and interpretation info */
export interface IndicatorInfo {
  readonly formula: string;
  readonly interpretation: string;
  readonly presetHints?: Record<number, string>;
}

export const INDICATOR_INFO: Record<string, IndicatorInfo> = {
  sma: {
    formula: "SMA = Σ(Close) / n",
    interpretation: "Above = bullish, below = bearish",
    presetHints: { 9: "Short", 20: "Monthly", 50: "Medium", 200: "Long" },
  },
  ema: {
    formula: "EMA = Close × k + EMA₍ₜ₋₁₎ × (1-k)",
    interpretation: "More responsive than SMA",
    presetHints: { 9: "Fast", 12: "MACD fast", 26: "MACD slow", 50: "Medium" },
  },
  vwap: {
    formula: "VWAP = Σ(TP × Vol) / Σ(Vol)",
    interpretation: "Institutional benchmark",
  },
  vwma: {
    formula: "VWMA = Σ(Close × Vol) / Σ(Vol)",
    interpretation: "Volume-weighted trend, better than SMA",
    presetHints: { 10: "Fast", 20: "Standard", 50: "Slow" },
  },
  bollingerBands: {
    formula: "BB = SMA ± (σ × multiplier)",
    interpretation: "Squeeze = low volatility, expansion = breakout",
    presetHints: { 10: "Fast", 20: "Standard", 50: "Slow" },
  },
  keltnerChannels: {
    formula: "KC = EMA ± (ATR × multiplier)",
    interpretation: "Trend filter, squeeze detection",
    presetHints: { 10: "Fast", 20: "Standard", 50: "Slow" },
  },
  donchianChannels: {
    formula: "DC = Highest High / Lowest Low",
    interpretation: "Breakout system (Turtle Trading)",
    presetHints: { 10: "Fast", 20: "Standard", 55: "Turtle" },
  },
  superTrend: {
    formula: "ST = HL2 ± (ATR × multiplier)",
    interpretation: "Green = uptrend, Red = downtrend",
    presetHints: { 7: "Sensitive", 10: "Standard", 14: "Smooth" },
  },
  parabolicSAR: {
    formula: "SAR = SAR₍ₜ₋₁₎ + AF × (EP - SAR₍ₜ₋₁₎)",
    interpretation: "Dots below = bullish, above = bearish",
  },
  rsi: {
    formula: "RSI = 100 - (100 / (1 + RS))",
    interpretation: ">70 overbought, <30 oversold",
    presetHints: { 7: "Sensitive", 14: "Standard", 21: "Smooth" },
  },
  macd: {
    formula: "MACD = EMA₁₂ - EMA₂₆",
    interpretation: "Cross above signal = bullish",
  },
  stochastic: {
    formula: "%K = (C - L) / (H - L) × 100",
    interpretation: ">80 overbought, <20 oversold",
    presetHints: { 5: "Fast", 14: "Standard", 21: "Slow" },
  },
  williamsR: {
    formula: "%R = (H - C) / (H - L) × -100",
    interpretation: ">-20 overbought, <-80 oversold",
    presetHints: { 7: "Fast", 14: "Standard", 21: "Slow" },
  },
  cci: {
    formula: "CCI = (TP - SMA) / (0.015 × MD)",
    interpretation: ">100 overbought, <-100 oversold",
    presetHints: { 14: "Fast", 20: "Standard", 50: "Slow" },
  },
  atr: {
    formula: "ATR = EMA(TR)",
    interpretation: "Volatility measure, position sizing",
    presetHints: { 7: "Fast", 14: "Standard", 21: "Slow" },
  },
  adx: {
    formula: "ADX = EMA(|+DI - -DI| / (+DI + -DI))",
    interpretation: ">25 strong trend, <20 no trend",
    presetHints: { 7: "Sensitive", 14: "Standard", 21: "Smooth" },
  },
  roc: {
    formula: "ROC = ((Close - Close₍ₙ₎) / Close₍ₙ₎) × 100",
    interpretation: "Positive = bullish momentum",
    presetHints: { 9: "Fast", 12: "Standard", 25: "Slow" },
  },
  momentum: {
    formula: "MOM = Close - Close₍ₙ₎",
    interpretation: "Above 0 = bullish, below = bearish",
    presetHints: { 10: "Standard", 14: "Medium", 21: "Slow" },
  },
  tsi: {
    formula: "TSI = 100 × EMA(EMA(PC)) / EMA(EMA(|PC|))",
    interpretation: "Less noise than RSI, -25/+25 signals",
  },
  obv: {
    formula: "OBV = OBV₍ₜ₋₁₎ ± Volume",
    interpretation: "Volume confirms price trend",
  },
  mfi: {
    formula: "MFI = 100 - (100 / (1 + MFR))",
    interpretation: ">80 overbought, <20 oversold",
    presetHints: { 7: "Fast", 14: "Standard", 21: "Slow" },
  },
  cmf: {
    formula: "CMF = Σ(MFV) / Σ(Volume)",
    interpretation: ">0 accumulation, <0 distribution",
    presetHints: { 10: "Fast", 20: "Standard", 21: "Slow" },
  },
  adLine: {
    formula: "A/D = A/D₍ₜ₋₁₎ + MFM × Volume",
    interpretation: "Rising = accumulation, falling = distribution",
  },
} as const;

/** Indicators that support multiple instances with different periods */
export const MULTI_INSTANCE_INDICATORS = ["sma", "ema"] as const;

/** Band indicators that return upper/middle/lower */
export const BAND_INDICATORS = ["bollingerBands", "keltnerChannels", "donchianChannels"] as const;

/** Color palettes for multi-instance indicators */
export const INDICATOR_COLORS: Record<string, readonly string[]> = {
  sma: ["#2962FF", "#1E88E5", "#1565C0", "#0D47A1"],
  ema: ["#FF6D00", "#F57C00", "#E65100", "#BF360C"],
  bollingerBands: ["#9C27B0", "#7B1FA2", "#6A1B9A"],
  keltnerChannels: ["#00BCD4", "#0097A7", "#00838F"],
  donchianChannels: ["#4CAF50", "#388E3C", "#2E7D32"],
} as const;

/** Default colors for single-instance indicators */
export const DEFAULT_INDICATOR_COLORS: Record<string, string> = {
  vwap: "#FF9800",
  vwma: "#FFC107",
  superTrend: "#00E676",
  parabolicSAR: "#FF4081",
  rsi: "#E91E63",
  macd: "#3F51B5",
  stochastic: "#009688",
  williamsR: "#795548",
  cci: "#607D8B",
  atr: "#FF5722",
  adx: "#9C27B0",
  roc: "#00BCD4",
  momentum: "#4CAF50",
  tsi: "#673AB7",
  obv: "#8BC34A",
  mfi: "#CDDC39",
  cmf: "#FF9800",
  adLine: "#03A9F4",
} as const;

/** Get indicator color by id and instance index */
export const getIndicatorColor = (baseId: string, index: number): string => {
  const palette = INDICATOR_COLORS[baseId];
  if (palette) {
    return palette[index % palette.length];
  }
  return DEFAULT_INDICATOR_COLORS[baseId] || "#6366f1";
};
