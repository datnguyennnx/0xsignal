/** Percent B (%B) - Position within Bollinger Bands */
// %B = (Price - Lower Band) / (Upper Band - Lower Band)

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateBollingerBands } from "../volatility/bollinger-bands";
import type { CryptoPrice } from "@0xsignal/shared";

export interface PercentBResult {
  readonly value: number;
  readonly signal:
    | "EXTREME_OVERBOUGHT"
    | "OVERBOUGHT"
    | "NEUTRAL"
    | "OVERSOLD"
    | "EXTREME_OVERSOLD";
  readonly position: "ABOVE_BANDS" | "UPPER_HALF" | "MIDDLE" | "LOWER_HALF" | "BELOW_BANDS";
  readonly meanReversionSetup: boolean;
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (v) => v > 1.2,
    () => "EXTREME_OVERBOUGHT" as const
  ),
  Match.when(
    (v) => v > 0.8,
    () => "OVERBOUGHT" as const
  ),
  Match.when(
    (v) => v < -0.2,
    () => "EXTREME_OVERSOLD" as const
  ),
  Match.when(
    (v) => v < 0.2,
    () => "OVERSOLD" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Position classification
const classifyPosition = Match.type<number>().pipe(
  Match.when(
    (v) => v > 1.0,
    () => "ABOVE_BANDS" as const
  ),
  Match.when(
    (v) => v > 0.6,
    () => "UPPER_HALF" as const
  ),
  Match.when(
    (v) => v > 0.4,
    () => "MIDDLE" as const
  ),
  Match.when(
    (v) => v >= 0.0,
    () => "LOWER_HALF" as const
  ),
  Match.orElse(() => "BELOW_BANDS" as const)
);

// Calculate Percent B
export const calculatePercentB = (price: number, upperBand: number, lowerBand: number): number => {
  const bandWidth = upperBand - lowerBand;
  return bandWidth === 0 ? 0.5 : (price - lowerBand) / bandWidth;
};

// Calculate %B with interpretation
export const calculatePctB = (price: CryptoPrice): PercentBResult => {
  const bb = calculateBollingerBands(price.price, price.high24h, price.low24h);
  const value = calculatePercentB(price.price, bb.upperBand, bb.lowerBand);

  return {
    value: Math.round(value * 10000) / 10000,
    signal: classifySignal(value),
    position: classifyPosition(value),
    meanReversionSetup: value > 1.0 || value < 0.0,
  };
};

// Effect-based wrapper
export const computePercentB = (price: CryptoPrice): Effect.Effect<PercentBResult> =>
  Effect.sync(() => calculatePctB(price));

export const PercentBMetadata: FormulaMetadata = {
  name: "PercentB",
  category: "statistical",
  difficulty: "intermediate",
  description: "Percent B - position within Bollinger Bands",
  requiredInputs: ["price", "high24h", "low24h"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "PercentBResult",
  useCases: [
    "overbought/oversold detection",
    "mean reversion trading",
    "band breakout identification",
    "relative price position",
  ],
  timeComplexity: "O(1)",
  dependencies: ["BollingerBands"],
};
