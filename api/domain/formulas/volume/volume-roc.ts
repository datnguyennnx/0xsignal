import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// VOLUME ROC (Volume Rate of Change) - Volume Momentum
// ============================================================================
// Measures the percentage change in volume over a period
// Identifies unusual volume activity
//
// Formula:
// Volume ROC = ((Current Volume - Volume n periods ago) / Volume n periods ago) × 100
//
// Interpretation:
// - High positive ROC: Unusual buying/selling activity
// - ROC > 100%: Volume doubled (significant activity)
// - ROC near 0: Normal volume activity
// - Spikes often precede price moves
// ============================================================================

export interface VolumeROCResult {
  readonly value: number; // Percentage change
  readonly signal: "SURGE" | "HIGH" | "NORMAL" | "LOW";
  readonly activity: "UNUSUAL" | "ELEVATED" | "NORMAL" | "QUIET";
}

/**
 * Pure function to calculate Volume ROC
 * @param volumes - Array of volumes
 * @param period - Lookback period (default: 14)
 */
export const calculateVolumeROC = (
  volumes: ReadonlyArray<number>,
  period: number = 14
): VolumeROCResult => {
  const currentVolume = volumes[volumes.length - 1];
  const pastVolume = volumes[volumes.length - 1 - period];

  // Calculate percentage change
  const value = pastVolume === 0 ? 0 : ((currentVolume - pastVolume) / pastVolume) * 100;

  // Determine signal
  let signal: "SURGE" | "HIGH" | "NORMAL" | "LOW";
  if (Math.abs(value) > 100) {
    signal = "SURGE";
  } else if (Math.abs(value) > 50) {
    signal = "HIGH";
  } else if (Math.abs(value) > 20) {
    signal = "NORMAL";
  } else {
    signal = "LOW";
  }

  // Determine activity level
  let activity: "UNUSUAL" | "ELEVATED" | "NORMAL" | "QUIET";
  if (Math.abs(value) > 100) {
    activity = "UNUSUAL";
  } else if (Math.abs(value) > 50) {
    activity = "ELEVATED";
  } else if (Math.abs(value) > 10) {
    activity = "NORMAL";
  } else {
    activity = "QUIET";
  }

  return {
    value: Math.round(value * 100) / 100,
    signal,
    activity,
  };
};

/**
 * Pure function to calculate Volume ROC series
 */
export const calculateVolumeROCSeries = (
  volumes: ReadonlyArray<number>,
  period: number = 14
): ReadonlyArray<number> => {
  const rocSeries: number[] = [];

  for (let i = period; i < volumes.length; i++) {
    const currentVolume = volumes[i];
    const pastVolume = volumes[i - period];
    const roc = pastVolume === 0 ? 0 : ((currentVolume - pastVolume) / pastVolume) * 100;
    rocSeries.push(roc);
  }

  return rocSeries;
};

/**
 * Effect-based wrapper for Volume ROC calculation
 */
export const computeVolumeROC = (
  volumes: ReadonlyArray<number>,
  period: number = 14
): Effect.Effect<VolumeROCResult> => Effect.sync(() => calculateVolumeROC(volumes, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const VolumeROCMetadata: FormulaMetadata = {
  name: "VolumeROC",
  category: "volume",
  difficulty: "intermediate",
  description: "Volume Rate of Change - volume momentum indicator",
  requiredInputs: ["volumes"],
  optionalInputs: ["period"],
  minimumDataPoints: 15,
  outputType: "VolumeROCResult",
  useCases: [
    "volume surge detection",
    "unusual activity identification",
    "breakout confirmation",
    "trend strength validation",
  ],
  timeComplexity: "O(1)",
  dependencies: [],
};
