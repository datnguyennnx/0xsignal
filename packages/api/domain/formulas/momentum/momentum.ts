/** Momentum - Absolute price change with functional patterns */
// Momentum = Current Price - Price N periods ago

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface MomentumResult {
  readonly value: number;
  readonly direction: "UP" | "DOWN" | "FLAT";
  readonly strength: number;
}

// Direction classification using Match
const classifyDirection = Match.type<number>().pipe(
  Match.when(
    (v) => v > 0,
    () => "UP" as const
  ),
  Match.when(
    (v) => v < 0,
    () => "DOWN" as const
  ),
  Match.orElse(() => "FLAT" as const)
);

// Round to 2 decimal places
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Calculate Momentum
export const calculateMomentum = (
  prices: ReadonlyArray<number>,
  period: number = 10
): MomentumResult => {
  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - period];
  const value = currentPrice - pastPrice;
  const percentChange = Math.abs((value / pastPrice) * 100);
  const strength = Math.min(percentChange * 10, 100);

  return {
    value: round2(value),
    direction: classifyDirection(value),
    strength: round2(strength),
  };
};

// Calculate Momentum series using Arr.makeBy
export const calculateMomentumSeries = (
  prices: ReadonlyArray<number>,
  period: number = 10
): ReadonlyArray<number> =>
  pipe(Arr.makeBy(prices.length - period, (i) => prices[i + period] - prices[i]));

// Effect-based wrapper
export const computeMomentum = (
  prices: ReadonlyArray<number>,
  period: number = 10
): Effect.Effect<MomentumResult> => Effect.sync(() => calculateMomentum(prices, period));

export const MomentumMetadata: FormulaMetadata = {
  name: "Momentum",
  category: "momentum",
  difficulty: "beginner",
  description: "Momentum - absolute price change over a period",
  requiredInputs: ["prices"],
  optionalInputs: ["period"],
  minimumDataPoints: 11,
  outputType: "MomentumResult",
  useCases: [
    "trend strength measurement",
    "momentum analysis",
    "divergence detection",
    "trend continuation signals",
  ],
  timeComplexity: "O(1)",
  dependencies: [],
};
