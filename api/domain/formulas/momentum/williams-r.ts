import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// WILLIAMS %R - Momentum Oscillator
// ============================================================================
// Measures the position of the current close relative to the high-low range
// Similar to Stochastic but inverted (ranges from -100 to 0)
//
// Formula:
// Williams %R = -100 * (Highest High - Close) / (Highest High - Lowest Low)
//
// Interpretation:
// - %R > -20: Overbought
// - %R < -80: Oversold
// - %R crosses above -80: Buy signal
// - %R crosses below -20: Sell signal
// ============================================================================

export interface WilliamsRResult {
  readonly value: number; // -100 to 0
  readonly signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  readonly momentum: "BULLISH" | "BEARISH" | "NEUTRAL";
}

/**
 * Pure function to calculate Williams %R
 * @param closes - Array of closing prices
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param period - Lookback period (default: 14)
 */
export const calculateWilliamsR = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 14
): WilliamsRResult => {
  // Get the last period values
  const recentCloses = closes.slice(-period);
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);

  // Find highest high and lowest low
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const currentClose = recentCloses[recentCloses.length - 1];

  // Calculate Williams %R
  const range = highestHigh - lowestLow;
  const value = range === 0 ? -50 : -100 * ((highestHigh - currentClose) / range);

  // Determine signal
  let signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  if (value > -20) {
    signal = "OVERBOUGHT";
  } else if (value < -80) {
    signal = "OVERSOLD";
  } else {
    signal = "NEUTRAL";
  }

  // Determine momentum
  let momentum: "BULLISH" | "BEARISH" | "NEUTRAL";
  if (value > -50) {
    momentum = "BULLISH";
  } else if (value < -50) {
    momentum = "BEARISH";
  } else {
    momentum = "NEUTRAL";
  }

  return {
    value: Math.round(value * 100) / 100,
    signal,
    momentum,
  };
};

/**
 * Pure function to calculate Williams %R series
 */
export const calculateWilliamsRSeries = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 14
): ReadonlyArray<number> => {
  const result: number[] = [];

  for (let i = period - 1; i < closes.length; i++) {
    const windowHighs = highs.slice(i - period + 1, i + 1);
    const windowLows = lows.slice(i - period + 1, i + 1);
    const windowClose = closes[i];

    const hh = Math.max(...windowHighs);
    const ll = Math.min(...windowLows);
    const r = hh - ll;
    const value = r === 0 ? -50 : -100 * ((hh - windowClose) / r);
    result.push(value);
  }

  return result;
};

/**
 * Effect-based wrapper with validation
 */
export const computeWilliamsR = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 14
): Effect.Effect<WilliamsRResult> =>
  Effect.sync(() => calculateWilliamsR(closes, highs, lows, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const WilliamsRMetadata: FormulaMetadata = {
  name: "WilliamsR",
  category: "momentum",
  difficulty: "beginner",
  description:
    "Williams %R - momentum oscillator measuring overbought/oversold levels",
  requiredInputs: ["closes", "highs", "lows"],
  optionalInputs: ["period"],
  minimumDataPoints: 14,
  outputType: "WilliamsRResult",
  useCases: [
    "overbought/oversold detection",
    "momentum analysis",
    "reversal signals",
    "divergence detection",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
