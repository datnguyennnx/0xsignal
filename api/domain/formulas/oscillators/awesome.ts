import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateSMA } from "../trend/moving-averages";

// ============================================================================
// AWESOME OSCILLATOR (AO) - Momentum Indicator
// ============================================================================
// Measures market momentum by comparing recent market momentum to general momentum
// Uses the difference between 5-period and 34-period SMAs of midpoint prices
//
// Formula:
// Midpoint = (High + Low) / 2
// AO = SMA(Midpoint, 5) - SMA(Midpoint, 34)
//
// Interpretation:
// - AO > 0: Bullish momentum
// - AO < 0: Bearish momentum
// - AO crosses above 0: Buy signal
// - AO crosses below 0: Sell signal
// - Twin Peaks: Divergence pattern
// ============================================================================

export interface AwesomeOscillatorResult {
  readonly value: number; // AO value
  readonly signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  readonly momentum: "INCREASING" | "DECREASING" | "STABLE";
  readonly histogram: "GREEN" | "RED";
}

/**
 * Pure function to calculate Awesome Oscillator
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param fastPeriod - Fast SMA period (default: 5)
 * @param slowPeriod - Slow SMA period (default: 34)
 */
export const calculateAwesomeOscillator = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  fastPeriod: number = 5,
  slowPeriod: number = 34
): AwesomeOscillatorResult => {
  // Calculate midpoint prices
  const midpoints = highs.map((high, i) => (high + lows[i]) / 2);

  // Calculate fast and slow SMAs
  const fastSMA = calculateSMA(midpoints.slice(-fastPeriod), fastPeriod).value;
  const slowSMA = calculateSMA(midpoints.slice(-slowPeriod), slowPeriod).value;

  // Calculate AO
  const ao = fastSMA - slowSMA;

  // Determine signal
  let signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  if (ao > 0) {
    signal = "BULLISH";
  } else if (ao < 0) {
    signal = "BEARISH";
  } else {
    signal = "NEUTRAL";
  }

  // Determine momentum (compare with previous AO)
  let momentum: "INCREASING" | "DECREASING" | "STABLE" = "STABLE";
  if (midpoints.length > slowPeriod) {
    const prevMidpoints = midpoints.slice(0, -1);
    const prevFastSMA = calculateSMA(
      prevMidpoints.slice(-fastPeriod),
      fastPeriod
    ).value;
    const prevSlowSMA = calculateSMA(
      prevMidpoints.slice(-slowPeriod),
      slowPeriod
    ).value;
    const prevAO = prevFastSMA - prevSlowSMA;

    if (ao > prevAO) {
      momentum = "INCREASING";
    } else if (ao < prevAO) {
      momentum = "DECREASING";
    }
  }

  // Determine histogram color
  const histogram: "GREEN" | "RED" = momentum === "INCREASING" ? "GREEN" : "RED";

  return {
    value: Math.round(ao * 100) / 100,
    signal,
    momentum,
    histogram,
  };
};

/**
 * Pure function to calculate Awesome Oscillator series
 */
export const calculateAwesomeOscillatorSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  fastPeriod: number = 5,
  slowPeriod: number = 34
): ReadonlyArray<number> => {
  const aoSeries: number[] = [];
  const midpoints = highs.map((high, i) => (high + lows[i]) / 2);

  for (let i = slowPeriod - 1; i < midpoints.length; i++) {
    const fastWindow = midpoints.slice(i - fastPeriod + 1, i + 1);
    const slowWindow = midpoints.slice(i - slowPeriod + 1, i + 1);

    const fastAvg = fastWindow.reduce((a, b) => a + b, 0) / fastPeriod;
    const slowAvg = slowWindow.reduce((a, b) => a + b, 0) / slowPeriod;

    aoSeries.push(fastAvg - slowAvg);
  }

  return aoSeries;
};

/**
 * Effect-based wrapper for Awesome Oscillator calculation
 */
export const computeAwesomeOscillator = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  fastPeriod: number = 5,
  slowPeriod: number = 34
): Effect.Effect<AwesomeOscillatorResult> =>
  Effect.sync(() =>
    calculateAwesomeOscillator(highs, lows, fastPeriod, slowPeriod)
  );

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const AwesomeOscillatorMetadata: FormulaMetadata = {
  name: "AwesomeOscillator",
  category: "oscillators",
  difficulty: "intermediate",
  description:
    "Awesome Oscillator - momentum indicator using midpoint SMAs",
  requiredInputs: ["highs", "lows"],
  optionalInputs: ["fastPeriod", "slowPeriod"],
  minimumDataPoints: 34,
  outputType: "AwesomeOscillatorResult",
  useCases: [
    "momentum measurement",
    "trend confirmation",
    "zero-line crossovers",
    "twin peaks pattern",
  ],
  timeComplexity: "O(n)",
  dependencies: ["SMA"],
};
