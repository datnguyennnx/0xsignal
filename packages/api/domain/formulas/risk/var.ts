/** Value at Risk (VaR) - Downside Risk Measure */
// VaR = Quantile of returns at (1 - confidence level)

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface VaRResult {
  readonly var95: number;
  readonly var99: number;
  readonly riskLevel: "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
}

// Risk level classification
const classifyRiskLevel = Match.type<number>().pipe(
  Match.when(
    (v) => v < 0.01,
    () => "LOW" as const
  ),
  Match.when(
    (v) => v < 0.02,
    () => "MODERATE" as const
  ),
  Match.when(
    (v) => v < 0.05,
    () => "HIGH" as const
  ),
  Match.orElse(() => "VERY_HIGH" as const)
);

// Calculate quantile from sorted array
const calculateQuantile = (sortedValues: ReadonlyArray<number>, quantile: number): number => {
  const index = quantile * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return lower === upper
    ? sortedValues[lower]
    : sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
};

// Calculate Value at Risk
export const calculateVaR = (returns: ReadonlyArray<number>): VaRResult => {
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const var95 = calculateQuantile(sortedReturns, 0.05);
  const var99 = calculateQuantile(sortedReturns, 0.01);

  return {
    var95: Math.round(var95 * 10000) / 100,
    var99: Math.round(var99 * 10000) / 100,
    riskLevel: classifyRiskLevel(Math.abs(var95)),
  };
};

// Effect-based wrapper
export const computeVaR = (returns: ReadonlyArray<number>): Effect.Effect<VaRResult> =>
  Effect.sync(() => calculateVaR(returns));

export const VaRMetadata: FormulaMetadata = {
  name: "VaR",
  category: "risk",
  difficulty: "advanced",
  description: "Value at Risk - maximum expected loss at confidence level",
  requiredInputs: ["returns"],
  optionalInputs: [],
  minimumDataPoints: 20,
  outputType: "VaRResult",
  useCases: [
    "risk management",
    "capital allocation",
    "regulatory compliance",
    "downside risk measurement",
  ],
  timeComplexity: "O(n log n)",
  dependencies: [],
};
