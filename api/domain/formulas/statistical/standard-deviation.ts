/** Standard Deviation - Dispersion measure */
// Population: sqrt(Sum[(x - mean)^2] / N), Sample: sqrt(Sum[(x - mean)^2] / (N-1))

import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

export interface StandardDeviationResult {
  readonly population: number;
  readonly sample: number;
  readonly variance: number;
  readonly mean: number;
}

// Calculate Standard Deviation
export const calculateStandardDeviation = (
  values: ReadonlyArray<number>
): StandardDeviationResult => {
  const n = values.length;
  const avg = mean([...values]);
  const squaredDiffs = values.map((x) => Math.pow(x - avg, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  const populationStdDev = Math.sqrt(variance);
  const sampleVariance = n > 1 ? squaredDiffs.reduce((a, b) => a + b, 0) / (n - 1) : variance;
  const sampleStdDev = Math.sqrt(sampleVariance);

  return {
    population: Math.round(populationStdDev * 10000) / 10000,
    sample: Math.round(sampleStdDev * 10000) / 10000,
    variance: Math.round(variance * 10000) / 10000,
    mean: Math.round(avg * 10000) / 10000,
  };
};

// Effect-based wrapper
export const computeStandardDeviation = (
  values: ReadonlyArray<number>
): Effect.Effect<StandardDeviationResult> => Effect.sync(() => calculateStandardDeviation(values));

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
