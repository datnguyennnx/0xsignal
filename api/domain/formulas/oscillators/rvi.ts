import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateSMA } from "../trend/moving-averages";

// ============================================================================
// RVI (Relative Vigor Index) - Momentum Oscillator
// ============================================================================
// Measures the conviction of a price trend by comparing closing price
// to opening price relative to the high-low range
//
// Formula:
// Numerator = (Close - Open) + 2×(Close[1] - Open[1]) + 2×(Close[2] - Open[2]) + (Close[3] - Open[3])
// Denominator = (High - Low) + 2×(High[1] - Low[1]) + 2×(High[2] - Low[2]) + (High[3] - Low[3])
// RVI = SMA(Numerator, period) / SMA(Denominator, period)
// Signal = SMA(RVI, 4)
//
// Interpretation:
// - RVI > 0: Bullish momentum
// - RVI < 0: Bearish momentum
// - RVI crosses above Signal: Buy signal
// - RVI crosses below Signal: Sell signal
// ============================================================================

export interface RVIResult {
  readonly rvi: number; // RVI value
  readonly signal: number; // Signal line
  readonly crossover: "BULLISH" | "BEARISH" | "NONE";
  readonly momentum: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
}

/**
 * Pure function to calculate weighted value
 */
const calculateWeightedValue = (
  values: ReadonlyArray<number>,
  index: number
): number => {
  if (index < 3) return 0;
  return (
    values[index] +
    2 * values[index - 1] +
    2 * values[index - 2] +
    values[index - 3]
  ) / 6;
};

/**
 * Pure function to calculate RVI
 * @param opens - Array of opening prices
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param period - RVI period (default: 10)
 */
export const calculateRVI = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 10
): RVIResult => {
  // Calculate numerator and denominator series
  const numerators: number[] = [];
  const denominators: number[] = [];

  for (let i = 3; i < closes.length; i++) {
    const closeOpen = closes.map((c, idx) => c - opens[idx]);
    const highLow = highs.map((h, idx) => h - lows[idx]);

    const num = calculateWeightedValue(closeOpen, i);
    const den = calculateWeightedValue(highLow, i);

    numerators.push(num);
    denominators.push(den);
  }

  // Calculate RVI using SMA
  const numSMA = calculateSMA(numerators.slice(-period), period).value;
  const denSMA = calculateSMA(denominators.slice(-period), period).value;

  const rvi = denSMA === 0 ? 0 : numSMA / denSMA;

  // Calculate RVI series for signal line
  const rviSeries: number[] = [];
  for (let i = period - 1; i < numerators.length; i++) {
    const numWindow = numerators.slice(i - period + 1, i + 1);
    const denWindow = denominators.slice(i - period + 1, i + 1);
    const nAvg = numWindow.reduce((a, b) => a + b, 0) / period;
    const dAvg = denWindow.reduce((a, b) => a + b, 0) / period;
    rviSeries.push(dAvg === 0 ? 0 : nAvg / dAvg);
  }

  // Calculate signal line (4-period SMA of RVI)
  const signal =
    rviSeries.length >= 4
      ? calculateSMA(rviSeries.slice(-4), 4).value
      : rvi;

  // Determine crossover
  let crossover: "BULLISH" | "BEARISH" | "NONE" = "NONE";
  if (rviSeries.length >= 2) {
    const prevRVI = rviSeries[rviSeries.length - 2];
    const prevSignal =
      rviSeries.length >= 5
        ? calculateSMA(rviSeries.slice(-5, -1), 4).value
        : prevRVI;

    if (prevRVI <= prevSignal && rvi > signal) {
      crossover = "BULLISH";
    } else if (prevRVI >= prevSignal && rvi < signal) {
      crossover = "BEARISH";
    }
  }

  // Determine momentum
  let momentum: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  if (rvi > 0.05) {
    momentum = "POSITIVE";
  } else if (rvi < -0.05) {
    momentum = "NEGATIVE";
  } else {
    momentum = "NEUTRAL";
  }

  return {
    rvi: Math.round(rvi * 1000) / 1000,
    signal: Math.round(signal * 1000) / 1000,
    crossover,
    momentum,
  };
};

/**
 * Effect-based wrapper for RVI calculation
 */
export const computeRVI = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 10
): Effect.Effect<RVIResult> =>
  Effect.sync(() => calculateRVI(opens, highs, lows, closes, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const RVIMetadata: FormulaMetadata = {
  name: "RVI",
  category: "oscillators",
  difficulty: "intermediate",
  description:
    "Relative Vigor Index - measures trend conviction using OHLC data",
  requiredInputs: ["opens", "highs", "lows", "closes"],
  optionalInputs: ["period"],
  minimumDataPoints: 13,
  outputType: "RVIResult",
  useCases: [
    "momentum measurement",
    "trend confirmation",
    "crossover signals",
    "divergence detection",
  ],
  timeComplexity: "O(n)",
  dependencies: ["SMA"],
};
