import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

// ============================================================================
// STOCHASTIC OSCILLATOR - Momentum Analysis
// ============================================================================
// Measures the position of the current close relative to the high-low range
// over a given period. Identifies overbought/oversold conditions.
//
// Formula:
// %K = 100 * (Close - Lowest Low) / (Highest High - Lowest Low)
// %D = SMA(%K, smoothing period)
//
// Interpretation:
// - %K > 80: Overbought
// - %K < 20: Oversold
// - %K crosses above %D: Buy signal
// - %K crosses below %D: Sell signal
// ============================================================================

export interface StochasticResult {
  readonly k: number; // %K value (0-100)
  readonly d: number; // %D value (0-100)
  readonly signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  readonly crossover: "BULLISH" | "BEARISH" | "NONE";
}

/**
 * Pure function to calculate Stochastic Oscillator
 * @param closes - Array of closing prices
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param kPeriod - Period for %K calculation (default: 14)
 * @param dPeriod - Period for %D smoothing (default: 3)
 */
export const calculateStochastic = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticResult => {
  // Get the last kPeriod values
  const recentCloses = closes.slice(-kPeriod);
  const recentHighs = highs.slice(-kPeriod);
  const recentLows = lows.slice(-kPeriod);

  // Find highest high and lowest low
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const currentClose = recentCloses[recentCloses.length - 1];

  // Calculate %K
  const range = highestHigh - lowestLow;
  const k = range === 0 ? 50 : ((currentClose - lowestLow) / range) * 100;

  // Calculate %K series for %D
  const kSeries: number[] = [];
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const windowHighs = highs.slice(i - kPeriod + 1, i + 1);
    const windowLows = lows.slice(i - kPeriod + 1, i + 1);
    const windowClose = closes[i];

    const hh = Math.max(...windowHighs);
    const ll = Math.min(...windowLows);
    const r = hh - ll;
    const kVal = r === 0 ? 50 : ((windowClose - ll) / r) * 100;
    kSeries.push(kVal);
  }

  // Calculate %D (SMA of %K)
  const recentK = kSeries.slice(-dPeriod);
  const d = mean(recentK);

  // Determine signal
  let signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  if (k > 80) {
    signal = "OVERBOUGHT";
  } else if (k < 20) {
    signal = "OVERSOLD";
  } else {
    signal = "NEUTRAL";
  }

  // Determine crossover
  let crossover: "BULLISH" | "BEARISH" | "NONE" = "NONE";
  if (kSeries.length >= 2) {
    const prevK = kSeries[kSeries.length - 2];
    const prevD = mean(kSeries.slice(-dPeriod - 1, -1));

    if (prevK <= prevD && k > d) {
      crossover = "BULLISH";
    } else if (prevK >= prevD && k < d) {
      crossover = "BEARISH";
    }
  }

  return {
    k: Math.round(k * 100) / 100,
    d: Math.round(d * 100) / 100,
    signal,
    crossover,
  };
};

/**
 * Pure function to calculate Stochastic series
 */
export const calculateStochasticSeries = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  kPeriod: number = 14,
  dPeriod: number = 3
): {
  readonly k: ReadonlyArray<number>;
  readonly d: ReadonlyArray<number>;
} => {
  const kSeries: number[] = [];

  // Calculate %K series
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const windowHighs = highs.slice(i - kPeriod + 1, i + 1);
    const windowLows = lows.slice(i - kPeriod + 1, i + 1);
    const windowClose = closes[i];

    const hh = Math.max(...windowHighs);
    const ll = Math.min(...windowLows);
    const r = hh - ll;
    const kVal = r === 0 ? 50 : ((windowClose - ll) / r) * 100;
    kSeries.push(kVal);
  }

  // Calculate %D series (SMA of %K)
  const dSeries: number[] = [];
  for (let i = dPeriod - 1; i < kSeries.length; i++) {
    const window = kSeries.slice(i - dPeriod + 1, i + 1);
    dSeries.push(mean(window));
  }

  return {
    k: kSeries,
    d: dSeries,
  };
};

/**
 * Effect-based wrapper with validation
 */
export const computeStochastic = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  kPeriod: number = 14,
  dPeriod: number = 3
): Effect.Effect<StochasticResult> =>
  Effect.sync(() => calculateStochastic(closes, highs, lows, kPeriod, dPeriod));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const StochasticMetadata: FormulaMetadata = {
  name: "Stochastic",
  category: "momentum",
  difficulty: "beginner",
  description: "Stochastic Oscillator - measures position relative to high-low range",
  requiredInputs: ["closes", "highs", "lows"],
  optionalInputs: ["kPeriod", "dPeriod"],
  minimumDataPoints: 17,
  outputType: "StochasticResult",
  useCases: [
    "overbought/oversold detection",
    "momentum analysis",
    "crossover signals",
    "divergence detection",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
