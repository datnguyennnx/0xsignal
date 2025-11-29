/** Calmar Ratio - Return to Drawdown Ratio */
// Calmar = Annualized Return / |Maximum Drawdown|

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";
import { calculateMaximumDrawdown } from "./maximum-drawdown";

export interface CalmarRatioResult {
  readonly value: number;
  readonly rating: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
  readonly annualizedReturn: number;
  readonly maxDrawdown: number;
}

// Rating classification
const classifyRating = Match.type<number>().pipe(
  Match.when(
    (c) => c > 3,
    () => "EXCELLENT" as const
  ),
  Match.when(
    (c) => c > 1,
    () => "GOOD" as const
  ),
  Match.when(
    (c) => c > 0.5,
    () => "ACCEPTABLE" as const
  ),
  Match.orElse(() => "POOR" as const)
);

// Safe division
const safeDivide = (num: number, denom: number): number => (denom === 0 ? 0 : num / denom);

// Calculate Calmar Ratio
export const calculateCalmarRatio = (
  returns: ReadonlyArray<number>,
  annualizationFactor: number = 252
): CalmarRatioResult => {
  const avgReturn = mean([...returns]);
  const annualizedReturn = avgReturn * annualizationFactor * 100;

  // Build cumulative returns for drawdown calculation
  const cumulativeReturns = returns.reduce<number[]>(
    (acc, r) => [...acc, (acc[acc.length - 1] ?? 1) * (1 + r)],
    [1]
  );

  const ddResult = calculateMaximumDrawdown(cumulativeReturns);
  const maxDrawdown = Math.abs(ddResult.value);
  const calmar = safeDivide(annualizedReturn, maxDrawdown);

  return {
    value: Math.round(calmar * 10000) / 10000,
    rating: classifyRating(calmar),
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
  };
};

// Effect-based wrapper
export const computeCalmarRatio = (
  returns: ReadonlyArray<number>,
  annualizationFactor: number = 252
): Effect.Effect<CalmarRatioResult> =>
  Effect.sync(() => calculateCalmarRatio(returns, annualizationFactor));

export const CalmarRatioMetadata: FormulaMetadata = {
  name: "CalmarRatio",
  category: "risk",
  difficulty: "advanced",
  description: "Calmar Ratio - return relative to maximum drawdown",
  requiredInputs: ["returns"],
  optionalInputs: ["annualizationFactor"],
  minimumDataPoints: 2,
  outputType: "CalmarRatioResult",
  useCases: [
    "drawdown risk assessment",
    "performance evaluation",
    "strategy comparison",
    "capital preservation focus",
  ],
  timeComplexity: "O(n)",
  dependencies: ["MaximumDrawdown"],
};
