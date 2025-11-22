import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateATR } from "../volatility/atr";

// ============================================================================
// SUPERTREND - Trend Following Indicator
// ============================================================================
// Uses ATR to create dynamic support/resistance levels
// Simple and effective trend indicator
//
// Formula:
// Basic Upper Band = (High + Low) / 2 + (Multiplier × ATR)
// Basic Lower Band = (High + Low) / 2 - (Multiplier × ATR)
//
// Final Bands:
// - If close > previous final upper band: trend is UP
// - If close < previous final lower band: trend is DOWN
//
// Interpretation:
// - Price above Supertrend: Bullish (buy signal)
// - Price below Supertrend: Bearish (sell signal)
// - Supertrend flip: Trend reversal
// ============================================================================

export interface SupertrendResult {
  readonly value: number; // Supertrend line value
  readonly trend: "BULLISH" | "BEARISH";
  readonly isReversal: boolean; // True if trend just changed
  readonly upperBand: number;
  readonly lowerBand: number;
}

/**
 * Pure function to calculate Supertrend
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param period - ATR period (default: 10)
 * @param multiplier - ATR multiplier (default: 3)
 */
export const calculateSupertrend = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 10,
  multiplier: number = 3
): SupertrendResult => {
  // Calculate ATR
  const atr = calculateATR(highs, lows, closes, period);

  // Calculate basic bands
  const hl2 = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
  const basicUpperBand = hl2 + multiplier * atr.value;
  const basicLowerBand = hl2 - multiplier * atr.value;

  // For simplicity, determine trend based on current price position
  const currentClose = closes[closes.length - 1];
  let trend: "BULLISH" | "BEARISH";
  let value: number;

  // Simple trend determination
  if (currentClose > hl2) {
    trend = "BULLISH";
    value = basicLowerBand;
  } else {
    trend = "BEARISH";
    value = basicUpperBand;
  }

  // Check for reversal (simplified - compare with previous period)
  let isReversal = false;
  if (closes.length > period + 1) {
    const prevClose = closes[closes.length - 2];
    const prevHL2 = (highs[highs.length - 2] + lows[lows.length - 2]) / 2;
    const prevTrend = prevClose > prevHL2 ? "BULLISH" : "BEARISH";
    isReversal = trend !== prevTrend;
  }

  return {
    value: Math.round(value * 100) / 100,
    trend,
    isReversal,
    upperBand: Math.round(basicUpperBand * 100) / 100,
    lowerBand: Math.round(basicLowerBand * 100) / 100,
  };
};

/**
 * Pure function to calculate Supertrend series
 */
export const calculateSupertrendSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 10,
  multiplier: number = 3
): ReadonlyArray<{ value: number; trend: "BULLISH" | "BEARISH" }> => {
  const result: { value: number; trend: "BULLISH" | "BEARISH" }[] = [];

  // Need at least period + 1 data points for ATR
  if (closes.length < period + 1) {
    return result;
  }

  for (let i = period; i < closes.length; i++) {
    const windowHighs = highs.slice(0, i + 1);
    const windowLows = lows.slice(0, i + 1);
    const windowCloses = closes.slice(0, i + 1);

    const st = calculateSupertrend(
      windowHighs,
      windowLows,
      windowCloses,
      period,
      multiplier
    );

    result.push({ value: st.value, trend: st.trend });
  }

  return result;
};

/**
 * Effect-based wrapper for Supertrend calculation
 */
export const computeSupertrend = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 10,
  multiplier: number = 3
): Effect.Effect<SupertrendResult> =>
  Effect.sync(() =>
    calculateSupertrend(highs, lows, closes, period, multiplier)
  );

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const SupertrendMetadata: FormulaMetadata = {
  name: "Supertrend",
  category: "trend",
  difficulty: "beginner",
  description: "Supertrend - ATR-based trend following indicator",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period", "multiplier"],
  minimumDataPoints: 11,
  outputType: "SupertrendResult",
  useCases: [
    "trend identification",
    "entry/exit signals",
    "stop-loss placement",
    "trend reversal detection",
  ],
  timeComplexity: "O(n)",
  dependencies: ["ATR"],
};
