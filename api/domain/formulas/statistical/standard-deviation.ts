import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

// ============================================================================
// STANDARD DEVIATION - Measure of Dispersion
// ============================================================================
// Measures the amount of variation or dispersion in a dataset
//
// Population StdDev: σ = √[Σ(x - μ)² / N]
// Sample StdDev: s = √[Σ(x - x̄)² / (N - 1)]
//
// Interpretation:
// - Low StdDev: Data points close to mean
// - High StdDev: Data points spread out
// - Used for volatility, risk assessment, quality control
// ============================================================================

export interface StandardDeviationResult {
  readonly population: number; // Population standard deviation
  readonly sample: number; // Sample standard deviation
  readonly variance: number; // Variance
  readonly mean: number; // Mean of the dataset
}

/**
 * Pure function to calculate Standard Deviation
 * @param values - Array of values
 */
export const calculateStandardDeviation = (
  values: ReadonlyArray<number>
): StandardDeviationResult => {
  const n = values.length;
  const avg = mean([...values]);

  // Calculate variance
  const squaredDiffs = values.map((x) => Math.pow(x - avg, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;

  // Population standard deviation
  const populationStdDev = Math.sqrt(variance);

  // Sample standard deviation (Bessel's correction)
  const sampleVariance = n > 1 ? (squaredDiffs.reduce((a, b) => a + b, 0) / (n - 1)) : variance;
  const sampleStdDev = Math.sqrt(sampleVariance);

  return {
    population: Math.round(populationStdDev * 10000) / 10000,
    sample: Math.round(sampleStdDev * 10000) / 10000,
    variance: Math.round(variance * 10000) / 10000,
    mean: Math.round(avg * 10000) / 10000,
  };
};

/**
 * Effect-based wrapper for Standard Deviation calculation
 */
export const computeStandardDeviation = (
  values: ReadonlyArray<number>
): Effect.Effect<StandardDeviationResult> =>
  Effect.sync(() => calculateStandardDeviation(values));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const StandardDeviationMetadata: FormulaMetadata = {
  name: "StandardDeviation",
  category: "statistical",
  difficulty: "advanced",
  description: "Standard Deviation - measures dispersion of data points",
  requiredInputs: ["values"],
  optionalInputs: [],
  minimumDataPoints: 2,
  outputType: "StandardDeviationResult",
  useCases: [
    "volatility measurement",
    "risk assessment",
    "quality control",
    "statistical analysis",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
