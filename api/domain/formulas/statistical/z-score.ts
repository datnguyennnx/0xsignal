import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";
import { calculateStandardDeviation } from "./standard-deviation";

// ============================================================================
// Z-SCORE - Standardization Measure
// ============================================================================
// Measures how many standard deviations a value is from the mean
//
// Formula:
// Z = (X - μ) / σ
//
// Interpretation:
// - Z = 0: Value equals the mean
// - Z > 0: Value above the mean
// - Z < 0: Value below the mean
// - |Z| > 2: Unusual value (outside 95% confidence)
// - |Z| > 3: Very unusual value (outside 99.7% confidence)
// ============================================================================

export interface ZScoreResult {
  readonly value: number; // Z-score
  readonly interpretation: "VERY_UNUSUAL" | "UNUSUAL" | "NORMAL";
  readonly percentile: number; // Approximate percentile (0-100)
}

/**
 * Pure function to calculate Z-Score
 * @param value - The value to standardize
 * @param dataset - The dataset for context
 */
export const calculateZScore = (value: number, dataset: ReadonlyArray<number>): ZScoreResult => {
  const stats = calculateStandardDeviation(dataset);
  const zScore = stats.population === 0 ? 0 : (value - stats.mean) / stats.population;

  // Determine interpretation
  let interpretation: "VERY_UNUSUAL" | "UNUSUAL" | "NORMAL";
  const absZ = Math.abs(zScore);
  if (absZ > 3) {
    interpretation = "VERY_UNUSUAL";
  } else if (absZ > 2) {
    interpretation = "UNUSUAL";
  } else {
    interpretation = "NORMAL";
  }

  // Approximate percentile using standard normal distribution
  // Using simplified approximation
  const percentile = 50 + 50 * Math.tanh(zScore / 2);

  return {
    value: Math.round(zScore * 10000) / 10000,
    interpretation,
    percentile: Math.round(percentile * 100) / 100,
  };
};

/**
 * Pure function to calculate Z-Scores for entire series
 */
export const calculateZScoreSeries = (values: ReadonlyArray<number>): ReadonlyArray<number> => {
  const stats = calculateStandardDeviation(values);
  return values.map((v) => (stats.population === 0 ? 0 : (v - stats.mean) / stats.population));
};

/**
 * Effect-based wrapper for Z-Score calculation
 */
export const computeZScore = (
  value: number,
  dataset: ReadonlyArray<number>
): Effect.Effect<ZScoreResult> => Effect.sync(() => calculateZScore(value, dataset));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const ZScoreMetadata: FormulaMetadata = {
  name: "ZScore",
  category: "statistical",
  difficulty: "advanced",
  description: "Z-Score - standardization measure relative to mean",
  requiredInputs: ["value", "dataset"],
  optionalInputs: [],
  minimumDataPoints: 2,
  outputType: "ZScoreResult",
  useCases: ["outlier detection", "standardization", "statistical comparison", "anomaly detection"],
  timeComplexity: "O(n)",
  dependencies: ["StandardDeviation"],
};
