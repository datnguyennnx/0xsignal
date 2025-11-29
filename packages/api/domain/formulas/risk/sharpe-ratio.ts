/** Sharpe Ratio - Risk-Adjusted Return Measure */
// Sharpe = (R_p - R_f) / σ_p, measures excess return per unit of risk

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";
import { calculateStandardDeviation } from "../statistical/standard-deviation";

export interface SharpeRatioResult {
  readonly value: number;
  readonly rating: "EXCELLENT" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE" | "POOR";
  readonly excessReturn: number;
  readonly volatility: number;
}

// Rating classification
const classifyRating = Match.type<number>().pipe(
  Match.when(
    (s) => s > 3,
    () => "EXCELLENT" as const
  ),
  Match.when(
    (s) => s > 2,
    () => "VERY_GOOD" as const
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

// Calculate Sharpe Ratio
export const calculateSharpeRatio = (
  returns: ReadonlyArray<number>,
  riskFreeRate: number = 0.02,
  annualizationFactor: number = 252
): SharpeRatioResult => {
  const avgReturn = mean([...returns]);
  const stats = calculateStandardDeviation(returns);
  const annualizedReturn = avgReturn * annualizationFactor;
  const annualizedVol = stats.population * Math.sqrt(annualizationFactor);
  const excessReturn = annualizedReturn - riskFreeRate;
  const sharpe = safeDivide(excessReturn, annualizedVol);

  return {
    value: Math.round(sharpe * 10000) / 10000,
    rating: classifyRating(sharpe),
    excessReturn: Math.round(excessReturn * 10000) / 10000,
    volatility: Math.round(annualizedVol * 10000) / 10000,
  };
};

// Effect-based wrapper
export const computeSharpeRatio = (
  returns: ReadonlyArray<number>,
  riskFreeRate: number = 0.02,
  annualizationFactor: number = 252
): Effect.Effect<SharpeRatioResult> =>
  Effect.sync(() => calculateSharpeRatio(returns, riskFreeRate, annualizationFactor));

export const SharpeRatioMetadata: FormulaMetadata = {
  name: "SharpeRatio",
  category: "risk",
  difficulty: "advanced",
  description: "Sharpe Ratio - risk-adjusted return measure",
  requiredInputs: ["returns"],
  optionalInputs: ["riskFreeRate", "annualizationFactor"],
  minimumDataPoints: 2,
  outputType: "SharpeRatioResult",
  useCases: [
    "performance evaluation",
    "strategy comparison",
    "risk-adjusted returns",
    "portfolio optimization",
  ],
  timeComplexity: "O(n)",
  dependencies: ["StandardDeviation"],
};
