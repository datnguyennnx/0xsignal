/** Sortino Ratio - Downside Risk-Adjusted Return */
// Sortino = (R_p - R_f) / σ_d, only penalizes downside volatility

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

export interface SortinoRatioResult {
  readonly value: number;
  readonly rating: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
  readonly downsideDeviation: number;
  readonly excessReturn: number;
}

// Rating classification
const classifyRating = Match.type<number>().pipe(
  Match.when(
    (s) => s > 2,
    () => "EXCELLENT" as const
  ),
  Match.when(
    (s) => s > 1,
    () => "GOOD" as const
  ),
  Match.when(
    (s) => s > 0,
    () => "ACCEPTABLE" as const
  ),
  Match.orElse(() => "POOR" as const)
);

// Safe division
const safeDivide = (num: number, denom: number): number => (denom === 0 ? 0 : num / denom);

// Calculate Sortino Ratio
export const calculateSortinoRatio = (
  returns: ReadonlyArray<number>,
  targetReturn: number = 0,
  annualizationFactor: number = 252
): SortinoRatioResult => {
  const avgReturn = mean([...returns]);

  // Downside deviation: only negative deviations from target
  const downsideVariance =
    returns
      .map((r) => Math.min(0, r - targetReturn))
      .map((r) => r * r)
      .reduce((a, b) => a + b, 0) / returns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  const annualizedReturn = avgReturn * annualizationFactor;
  const annualizedDownsideDev = downsideDeviation * Math.sqrt(annualizationFactor);
  const annualizedTarget = targetReturn * annualizationFactor;
  const excessReturn = annualizedReturn - annualizedTarget;
  const sortino = safeDivide(excessReturn, annualizedDownsideDev);

  return {
    value: Math.round(sortino * 10000) / 10000,
    rating: classifyRating(sortino),
    downsideDeviation: Math.round(annualizedDownsideDev * 10000) / 10000,
    excessReturn: Math.round(excessReturn * 10000) / 10000,
  };
};

// Effect-based wrapper
export const computeSortinoRatio = (
  returns: ReadonlyArray<number>,
  targetReturn: number = 0,
  annualizationFactor: number = 252
): Effect.Effect<SortinoRatioResult> =>
  Effect.sync(() => calculateSortinoRatio(returns, targetReturn, annualizationFactor));

export const SortinoRatioMetadata: FormulaMetadata = {
  name: "SortinoRatio",
  category: "risk",
  difficulty: "advanced",
  description: "Sortino Ratio - downside risk-adjusted return measure",
  requiredInputs: ["returns"],
  optionalInputs: ["targetReturn", "annualizationFactor"],
  minimumDataPoints: 2,
  outputType: "SortinoRatioResult",
  useCases: [
    "downside risk assessment",
    "performance evaluation",
    "strategy comparison",
    "asymmetric risk measurement",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
