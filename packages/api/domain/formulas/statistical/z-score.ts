/** Z-Score - Standardization measure */
// Z = (X - mean) / stddev

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateStandardDeviation } from "./standard-deviation";

export interface ZScoreResult {
  readonly value: number;
  readonly interpretation: "VERY_UNUSUAL" | "UNUSUAL" | "NORMAL";
  readonly percentile: number;
}

// Interpretation classification
const classifyInterpretation = Match.type<number>().pipe(
  Match.when(
    (v) => v > 3,
    () => "VERY_UNUSUAL" as const
  ),
  Match.when(
    (v) => v > 2,
    () => "UNUSUAL" as const
  ),
  Match.orElse(() => "NORMAL" as const)
);

// Calculate Z-Score
export const calculateZScore = (value: number, dataset: ReadonlyArray<number>): ZScoreResult => {
  const stats = calculateStandardDeviation(dataset);
  const zScore = stats.population === 0 ? 0 : (value - stats.mean) / stats.population;
  const percentile = 50 + 50 * Math.tanh(zScore / 2);

  return {
    value: Math.round(zScore * 10000) / 10000,
    interpretation: classifyInterpretation(Math.abs(zScore)),
    percentile: Math.round(percentile * 100) / 100,
  };
};

// Calculate Z-Scores for entire series
export const calculateZScoreSeries = (values: ReadonlyArray<number>): ReadonlyArray<number> => {
  const stats = calculateStandardDeviation(values);
  return values.map((v) => (stats.population === 0 ? 0 : (v - stats.mean) / stats.population));
};

// Effect-based wrapper
export const computeZScore = (
  value: number,
  dataset: ReadonlyArray<number>
): Effect.Effect<ZScoreResult> => Effect.sync(() => calculateZScore(value, dataset));

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
