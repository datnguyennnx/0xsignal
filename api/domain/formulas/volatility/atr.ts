import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateEMA } from "../trend/moving-averages";

// ============================================================================
// ATR (Average True Range) - Volatility Measurement
// ============================================================================
// Measures market volatility by calculating the average of true ranges
// True Range is the greatest of:
// 1. Current High - Current Low
// 2. |Current High - Previous Close|
// 3. |Current Low - Previous Close|
//
// Formula:
// TR = max(High - Low, |High - PrevClose|, |Low - PrevClose|)
// ATR = EMA(TR, period)
//
// Interpretation:
// - High ATR: High volatility
// - Low ATR: Low volatility
// - Rising ATR: Increasing volatility
// - Falling ATR: Decreasing volatility
// ============================================================================

export interface ATRResult {
  readonly value: number; // ATR value
  readonly normalizedATR: number; // ATR as percentage of price
  readonly volatilityLevel: "VERY_LOW" | "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH";
}

/**
 * Pure function to calculate True Range
 */
export const calculateTrueRange = (high: number, low: number, previousClose: number): number => {
  const range1 = high - low;
  const range2 = Math.abs(high - previousClose);
  const range3 = Math.abs(low - previousClose);

  return Math.max(range1, range2, range3);
};

/**
 * Pure function to calculate ATR
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param period - ATR period (default: 14)
 */
export const calculateATR = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 14
): ATRResult => {
  // Calculate True Range series
  const trSeries: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const tr = calculateTrueRange(highs[i], lows[i], closes[i - 1]);
    trSeries.push(tr);
  }

  // Calculate ATR using EMA of TR
  const atr = calculateEMA(trSeries, period);
  const currentPrice = closes[closes.length - 1];

  // Normalized ATR (as percentage of price)
  const normalizedATR = (atr.value / currentPrice) * 100;

  // Determine volatility level
  let volatilityLevel: "VERY_LOW" | "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH";
  if (normalizedATR < 1) {
    volatilityLevel = "VERY_LOW";
  } else if (normalizedATR < 2) {
    volatilityLevel = "LOW";
  } else if (normalizedATR < 4) {
    volatilityLevel = "NORMAL";
  } else if (normalizedATR < 6) {
    volatilityLevel = "HIGH";
  } else {
    volatilityLevel = "VERY_HIGH";
  }

  return {
    value: Math.round(atr.value * 100) / 100,
    normalizedATR: Math.round(normalizedATR * 100) / 100,
    volatilityLevel,
  };
};

/**
 * Pure function to calculate ATR series
 */
export const calculateATRSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 14
): ReadonlyArray<number> => {
  // Calculate True Range series
  const trSeries: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const tr = calculateTrueRange(highs[i], lows[i], closes[i - 1]);
    trSeries.push(tr);
  }

  // Calculate ATR series using EMA
  const alpha = 2 / (period + 1);
  const atrSeries: number[] = [];

  // First ATR is SMA of first period TRs
  let atr = trSeries.slice(0, period).reduce((a, b) => a + b, 0) / period;
  atrSeries.push(atr);

  // Subsequent ATRs use EMA
  for (let i = period; i < trSeries.length; i++) {
    atr = trSeries[i] * alpha + atr * (1 - alpha);
    atrSeries.push(atr);
  }

  return atrSeries;
};

/**
 * Effect-based wrapper for ATR calculation
 */
export const computeATR = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 14
): Effect.Effect<ATRResult> => Effect.sync(() => calculateATR(highs, lows, closes, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const ATRMetadata: FormulaMetadata = {
  name: "ATR",
  category: "volatility",
  difficulty: "beginner",
  description: "Average True Range - measures market volatility",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period"],
  minimumDataPoints: 15,
  outputType: "ATRResult",
  useCases: [
    "volatility measurement",
    "stop-loss placement",
    "position sizing",
    "breakout confirmation",
  ],
  timeComplexity: "O(n)",
  dependencies: ["EMA"],
};
