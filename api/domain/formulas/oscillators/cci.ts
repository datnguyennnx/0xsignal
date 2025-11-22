import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

// ============================================================================
// CCI (Commodity Channel Index) - Momentum Oscillator
// ============================================================================
// Measures the deviation of price from its statistical mean
// Identifies cyclical trends and overbought/oversold conditions
//
// Formula:
// Typical Price = (High + Low + Close) / 3
// SMA = Simple Moving Average of Typical Price
// Mean Deviation = Average of |Typical Price - SMA|
// CCI = (Typical Price - SMA) / (0.015 × Mean Deviation)
//
// Interpretation:
// - CCI > +100: Overbought
// - CCI < -100: Oversold
// - CCI > +200: Very strong uptrend
// - CCI < -200: Very strong downtrend
// ============================================================================

export interface CCIResult {
  readonly value: number; // CCI value
  readonly signal: "EXTREME_OVERBOUGHT" | "OVERBOUGHT" | "NEUTRAL" | "OVERSOLD" | "EXTREME_OVERSOLD";
  readonly trend: "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_BEARISH";
}

/**
 * Pure function to calculate CCI
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param period - CCI period (default: 20)
 */
export const calculateCCI = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 20
): CCIResult => {
  // Calculate typical prices
  const typicalPrices: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
  }

  // Get recent typical prices
  const recentTP = typicalPrices.slice(-period);

  // Calculate SMA of typical price
  const sma = mean(recentTP);

  // Calculate mean deviation
  const deviations = recentTP.map((tp) => Math.abs(tp - sma));
  const meanDeviation = mean(deviations);

  // Calculate CCI
  const currentTP = typicalPrices[typicalPrices.length - 1];
  const cci = meanDeviation === 0 ? 0 : (currentTP - sma) / (0.015 * meanDeviation);

  // Determine signal
  let signal: "EXTREME_OVERBOUGHT" | "OVERBOUGHT" | "NEUTRAL" | "OVERSOLD" | "EXTREME_OVERSOLD";
  if (cci > 200) {
    signal = "EXTREME_OVERBOUGHT";
  } else if (cci > 100) {
    signal = "OVERBOUGHT";
  } else if (cci < -200) {
    signal = "EXTREME_OVERSOLD";
  } else if (cci < -100) {
    signal = "OVERSOLD";
  } else {
    signal = "NEUTRAL";
  }

  // Determine trend
  let trend: "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_BEARISH";
  if (cci > 200) {
    trend = "STRONG_BULLISH";
  } else if (cci > 100) {
    trend = "BULLISH";
  } else if (cci < -200) {
    trend = "STRONG_BEARISH";
  } else if (cci < -100) {
    trend = "BEARISH";
  } else {
    trend = "NEUTRAL";
  }

  return {
    value: Math.round(cci * 100) / 100,
    signal,
    trend,
  };
};

/**
 * Pure function to calculate CCI series
 */
export const calculateCCISeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 20
): ReadonlyArray<number> => {
  const cciSeries: number[] = [];

  // Calculate typical prices
  const typicalPrices: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
  }

  // Calculate CCI for each point
  for (let i = period - 1; i < typicalPrices.length; i++) {
    const window = typicalPrices.slice(i - period + 1, i + 1);
    const sma = mean(window);
    const deviations = window.map((tp) => Math.abs(tp - sma));
    const meanDeviation = mean(deviations);
    const currentTP = typicalPrices[i];
    const cci = meanDeviation === 0 ? 0 : (currentTP - sma) / (0.015 * meanDeviation);
    cciSeries.push(cci);
  }

  return cciSeries;
};

/**
 * Effect-based wrapper for CCI calculation
 */
export const computeCCI = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 20
): Effect.Effect<CCIResult> =>
  Effect.sync(() => calculateCCI(highs, lows, closes, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const CCIMetadata: FormulaMetadata = {
  name: "CCI",
  category: "oscillators",
  difficulty: "intermediate",
  description:
    "Commodity Channel Index - measures deviation from statistical mean",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period"],
  minimumDataPoints: 20,
  outputType: "CCIResult",
  useCases: [
    "overbought/oversold detection",
    "trend identification",
    "divergence analysis",
    "cyclical turning points",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
