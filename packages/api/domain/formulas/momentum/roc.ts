/** ROC (Rate of Change) - Percentage price change with functional patterns */
// ROC = ((Current - Past) / Past) * 100

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface ROCResult {
  readonly value: number;
  readonly signal: "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_BEARISH";
  readonly momentum: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (v) => v > 10,
    () => "STRONG_BULLISH" as const
  ),
  Match.when(
    (v) => v > 0,
    () => "BULLISH" as const
  ),
  Match.when(
    (v) => v < -10,
    () => "STRONG_BEARISH" as const
  ),
  Match.when(
    (v) => v < 0,
    () => "BEARISH" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Momentum classification
const classifyMomentum = Match.type<number>().pipe(
  Match.when(
    (v) => v > 0,
    () => "POSITIVE" as const
  ),
  Match.when(
    (v) => v < 0,
    () => "NEGATIVE" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Round to 2 decimal places
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Calculate ROC
export const calculateROC = (prices: ReadonlyArray<number>, period: number = 12): ROCResult => {
  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - period];
  const value = ((currentPrice - pastPrice) / pastPrice) * 100;

  return {
    value: round2(value),
    signal: classifySignal(value),
    momentum: classifyMomentum(value),
  };
};

// Calculate ROC series using Arr.zipWith
export const calculateROCSeries = (
  prices: ReadonlyArray<number>,
  period: number = 12
): ReadonlyArray<number> =>
  pipe(
    Arr.zipWith(
      Arr.drop(prices, period),
      Arr.dropRight(prices, period),
      (current, past) => ((current - past) / past) * 100
    )
  );

// Effect-based wrapper
export const computeROC = (
  prices: ReadonlyArray<number>,
  period: number = 12
): Effect.Effect<ROCResult> => Effect.sync(() => calculateROC(prices, period));

export const ROCMetadata: FormulaMetadata = {
  name: "ROC",
  category: "momentum",
  difficulty: "beginner",
  description: "Rate of Change - percentage change in price over a period",
  requiredInputs: ["prices"],
  optionalInputs: ["period"],
  minimumDataPoints: 13,
  outputType: "ROCResult",
  useCases: [
    "momentum measurement",
    "trend strength analysis",
    "divergence detection",
    "overbought/oversold conditions",
  ],
  timeComplexity: "O(1)",
  dependencies: [],
};
