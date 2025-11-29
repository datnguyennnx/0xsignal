/** Distance from Moving Average - Mean reversion indicator */
// Distance = (Price - MA) / MA * 100

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";
import type { CryptoPrice } from "@0xsignal/shared";

export interface DistanceFromMAResult {
  readonly distance: number;
  readonly signal: "EXTREME_ABOVE" | "ABOVE" | "NEUTRAL" | "BELOW" | "EXTREME_BELOW";
  readonly meanReversionSetup: boolean;
  readonly strength: number;
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (v) => v > 10,
    () => "EXTREME_ABOVE" as const
  ),
  Match.when(
    (v) => v > 5,
    () => "ABOVE" as const
  ),
  Match.when(
    (v) => v < -10,
    () => "EXTREME_BELOW" as const
  ),
  Match.when(
    (v) => v < -5,
    () => "BELOW" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Calculate Distance from MA
export const calculateDistanceFromMA = (price: CryptoPrice): DistanceFromMAResult => {
  const ma =
    price.high24h && price.low24h ? (price.high24h + price.low24h + price.price) / 3 : price.price;
  const distance = ma === 0 ? 0 : ((price.price - ma) / ma) * 100;
  const strength = Math.min(Math.abs(distance) * 5, 100);

  return {
    distance: Math.round(distance * 100) / 100,
    signal: classifySignal(distance),
    meanReversionSetup: Math.abs(distance) > 5,
    strength: Math.round(strength),
  };
};

// Effect-based wrapper
export const computeDistanceFromMA = (price: CryptoPrice): Effect.Effect<DistanceFromMAResult> =>
  Effect.sync(() => calculateDistanceFromMA(price));

export const DistanceFromMAMetadata: FormulaMetadata = {
  name: "DistanceFromMA",
  category: "statistical",
  difficulty: "intermediate",
  description: "Distance from Moving Average - mean reversion indicator",
  requiredInputs: ["price", "high24h", "low24h"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "DistanceFromMAResult",
  useCases: [
    "mean reversion trading",
    "overbought/oversold detection",
    "deviation measurement",
    "reversal opportunity identification",
  ],
  timeComplexity: "O(1)",
  dependencies: [],
};
