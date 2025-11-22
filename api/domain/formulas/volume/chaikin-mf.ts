import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

// ============================================================================
// CHAIKIN MONEY FLOW (CMF) - Volume-Weighted Accumulation/Distribution
// ============================================================================
// Measures the amount of money flow over a specific period
// Oscillates between -1 and +1
//
// Formula:
// Money Flow Multiplier = ((Close - Low) - (High - Close)) / (High - Low)
// Money Flow Volume = Money Flow Multiplier × Volume
// CMF = Sum(Money Flow Volume, period) / Sum(Volume, period)
//
// Interpretation:
// - CMF > 0: Buying pressure (accumulation)
// - CMF < 0: Selling pressure (distribution)
// - CMF > 0.25: Strong buying pressure
// - CMF < -0.25: Strong selling pressure
// ============================================================================

export interface ChaikinMFResult {
  readonly value: number; // CMF value (-1 to +1)
  readonly signal: "STRONG_BUYING" | "BUYING" | "NEUTRAL" | "SELLING" | "STRONG_SELLING";
  readonly pressure: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
}

/**
 * Pure function to calculate Money Flow Multiplier
 */
const calculateMoneyFlowMultiplier = (
  high: number,
  low: number,
  close: number
): number => {
  const range = high - low;
  if (range === 0) return 0;
  return ((close - low) - (high - close)) / range;
};

/**
 * Pure function to calculate Chaikin Money Flow
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param volumes - Array of volumes
 * @param period - CMF period (default: 21)
 */
export const calculateChaikinMF = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 21
): ChaikinMFResult => {
  // Get the last period values
  const startIdx = Math.max(0, closes.length - period);
  const recentHighs = highs.slice(startIdx);
  const recentLows = lows.slice(startIdx);
  const recentCloses = closes.slice(startIdx);
  const recentVolumes = volumes.slice(startIdx);

  // Calculate money flow volume and total volume
  let sumMFV = 0;
  let sumVolume = 0;

  for (let i = 0; i < recentCloses.length; i++) {
    const mfm = calculateMoneyFlowMultiplier(
      recentHighs[i],
      recentLows[i],
      recentCloses[i]
    );
    const mfv = mfm * recentVolumes[i];
    sumMFV += mfv;
    sumVolume += recentVolumes[i];
  }

  // Calculate CMF
  const cmf = sumVolume === 0 ? 0 : sumMFV / sumVolume;

  // Determine signal
  let signal: "STRONG_BUYING" | "BUYING" | "NEUTRAL" | "SELLING" | "STRONG_SELLING";
  if (cmf > 0.25) {
    signal = "STRONG_BUYING";
  } else if (cmf > 0) {
    signal = "BUYING";
  } else if (cmf < -0.25) {
    signal = "STRONG_SELLING";
  } else if (cmf < 0) {
    signal = "SELLING";
  } else {
    signal = "NEUTRAL";
  }

  // Determine pressure
  let pressure: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  if (cmf > 0.05) {
    pressure = "ACCUMULATION";
  } else if (cmf < -0.05) {
    pressure = "DISTRIBUTION";
  } else {
    pressure = "NEUTRAL";
  }

  return {
    value: Math.round(cmf * 1000) / 1000,
    signal,
    pressure,
  };
};

/**
 * Pure function to calculate Chaikin Money Flow series
 */
export const calculateChaikinMFSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 21
): ReadonlyArray<number> => {
  const cmfSeries: number[] = [];

  for (let i = period - 1; i < closes.length; i++) {
    const windowHighs = highs.slice(i - period + 1, i + 1);
    const windowLows = lows.slice(i - period + 1, i + 1);
    const windowCloses = closes.slice(i - period + 1, i + 1);
    const windowVolumes = volumes.slice(i - period + 1, i + 1);

    let sumMFV = 0;
    let sumVolume = 0;

    for (let j = 0; j < period; j++) {
      const mfm = calculateMoneyFlowMultiplier(
        windowHighs[j],
        windowLows[j],
        windowCloses[j]
      );
      const mfv = mfm * windowVolumes[j];
      sumMFV += mfv;
      sumVolume += windowVolumes[j];
    }

    const cmf = sumVolume === 0 ? 0 : sumMFV / sumVolume;
    cmfSeries.push(cmf);
  }

  return cmfSeries;
};

/**
 * Effect-based wrapper for Chaikin Money Flow calculation
 */
export const computeChaikinMF = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 21
): Effect.Effect<ChaikinMFResult> =>
  Effect.sync(() => calculateChaikinMF(highs, lows, closes, volumes, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const ChaikinMFMetadata: FormulaMetadata = {
  name: "ChaikinMF",
  category: "volume",
  difficulty: "intermediate",
  description:
    "Chaikin Money Flow - volume-weighted accumulation/distribution oscillator",
  requiredInputs: ["highs", "lows", "closes", "volumes"],
  optionalInputs: ["period"],
  minimumDataPoints: 21,
  outputType: "ChaikinMFResult",
  useCases: [
    "buying/selling pressure measurement",
    "trend confirmation",
    "divergence detection",
    "accumulation/distribution analysis",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
