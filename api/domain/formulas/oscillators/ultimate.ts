import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// ULTIMATE OSCILLATOR - Multi-Timeframe Momentum Indicator
// ============================================================================
// Combines three different timeframes to reduce false signals
// Uses buying pressure relative to true range
//
// Formula:
// Buying Pressure = Close - min(Low, Previous Close)
// True Range = max(High, Previous Close) - min(Low, Previous Close)
// Average7 = Sum(BP, 7) / Sum(TR, 7)
// Average14 = Sum(BP, 14) / Sum(TR, 14)
// Average28 = Sum(BP, 28) / Sum(TR, 28)
// UO = 100 × [(4 × Average7) + (2 × Average14) + Average28] / (4 + 2 + 1)
//
// Interpretation:
// - UO > 70: Overbought
// - UO < 30: Oversold
// - Bullish divergence: Buy signal
// - Bearish divergence: Sell signal
// ============================================================================

export interface UltimateOscillatorResult {
  readonly value: number; // UO value (0-100)
  readonly signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  readonly trend: "BULLISH" | "BEARISH" | "NEUTRAL";
}

/**
 * Pure function to calculate buying pressure and true range
 */
const calculateBPandTR = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>
): { bp: number[]; tr: number[] } => {
  const bp: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const buyingPressure = closes[i] - Math.min(lows[i], closes[i - 1]);
    const trueRange = Math.max(highs[i], closes[i - 1]) - Math.min(lows[i], closes[i - 1]);

    bp.push(buyingPressure);
    tr.push(trueRange);
  }

  return { bp, tr };
};

/**
 * Pure function to calculate Ultimate Oscillator
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param period1 - Short period (default: 7)
 * @param period2 - Medium period (default: 14)
 * @param period3 - Long period (default: 28)
 */
export const calculateUltimateOscillator = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period1: number = 7,
  period2: number = 14,
  period3: number = 28
): UltimateOscillatorResult => {
  // Calculate buying pressure and true range
  const { bp, tr } = calculateBPandTR(highs, lows, closes);

  // Calculate averages for each period
  const sumBP1 = bp.slice(-period1).reduce((a, b) => a + b, 0);
  const sumTR1 = tr.slice(-period1).reduce((a, b) => a + b, 0);
  const avg1 = sumTR1 === 0 ? 0 : sumBP1 / sumTR1;

  const sumBP2 = bp.slice(-period2).reduce((a, b) => a + b, 0);
  const sumTR2 = tr.slice(-period2).reduce((a, b) => a + b, 0);
  const avg2 = sumTR2 === 0 ? 0 : sumBP2 / sumTR2;

  const sumBP3 = bp.slice(-period3).reduce((a, b) => a + b, 0);
  const sumTR3 = tr.slice(-period3).reduce((a, b) => a + b, 0);
  const avg3 = sumTR3 === 0 ? 0 : sumBP3 / sumTR3;

  // Calculate Ultimate Oscillator with 4:2:1 weighting
  const uo = (100 * (4 * avg1 + 2 * avg2 + avg3)) / 7;

  // Determine signal
  let signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  if (uo > 70) {
    signal = "OVERBOUGHT";
  } else if (uo < 30) {
    signal = "OVERSOLD";
  } else {
    signal = "NEUTRAL";
  }

  // Determine trend
  let trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  if (uo > 50) {
    trend = "BULLISH";
  } else if (uo < 50) {
    trend = "BEARISH";
  } else {
    trend = "NEUTRAL";
  }

  return {
    value: Math.round(uo * 100) / 100,
    signal,
    trend,
  };
};

/**
 * Pure function to calculate Ultimate Oscillator series
 */
export const calculateUltimateOscillatorSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period1: number = 7,
  period2: number = 14,
  period3: number = 28
): ReadonlyArray<number> => {
  const uoSeries: number[] = [];
  const { bp, tr } = calculateBPandTR(highs, lows, closes);

  for (let i = period3 - 1; i < bp.length; i++) {
    const sumBP1 = bp.slice(i - period1 + 1, i + 1).reduce((a, b) => a + b, 0);
    const sumTR1 = tr.slice(i - period1 + 1, i + 1).reduce((a, b) => a + b, 0);
    const avg1 = sumTR1 === 0 ? 0 : sumBP1 / sumTR1;

    const sumBP2 = bp.slice(i - period2 + 1, i + 1).reduce((a, b) => a + b, 0);
    const sumTR2 = tr.slice(i - period2 + 1, i + 1).reduce((a, b) => a + b, 0);
    const avg2 = sumTR2 === 0 ? 0 : sumBP2 / sumTR2;

    const sumBP3 = bp.slice(i - period3 + 1, i + 1).reduce((a, b) => a + b, 0);
    const sumTR3 = tr.slice(i - period3 + 1, i + 1).reduce((a, b) => a + b, 0);
    const avg3 = sumTR3 === 0 ? 0 : sumBP3 / sumTR3;

    const uo = (100 * (4 * avg1 + 2 * avg2 + avg3)) / 7;
    uoSeries.push(uo);
  }

  return uoSeries;
};

/**
 * Effect-based wrapper for Ultimate Oscillator calculation
 */
export const computeUltimateOscillator = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period1: number = 7,
  period2: number = 14,
  period3: number = 28
): Effect.Effect<UltimateOscillatorResult> =>
  Effect.sync(() => calculateUltimateOscillator(highs, lows, closes, period1, period2, period3));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const UltimateOscillatorMetadata: FormulaMetadata = {
  name: "UltimateOscillator",
  category: "oscillators",
  difficulty: "intermediate",
  description: "Ultimate Oscillator - multi-timeframe momentum indicator",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period1", "period2", "period3"],
  minimumDataPoints: 29,
  outputType: "UltimateOscillatorResult",
  useCases: [
    "overbought/oversold detection",
    "divergence analysis",
    "multi-timeframe confirmation",
    "reduced false signals",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
