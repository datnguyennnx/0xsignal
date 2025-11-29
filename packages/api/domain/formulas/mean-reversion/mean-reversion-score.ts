/** Mean Reversion Score - Composite mean reversion signal */
// Score = 0.3*PercentB + 0.25*BBWidth + 0.25*DistanceMA + 0.2*KeltnerWidth

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";
import type { CryptoPrice } from "@0xsignal/shared";
import { calculatePctB } from "./percent-b";
import { calculateBBWidth } from "./bollinger-width";
import { calculateDistanceFromMA } from "./distance-from-ma";
import { calculateKeltnerWidth } from "./keltner-width";

export interface MeanReversionScoreResult {
  readonly score: number;
  readonly direction: "BUY" | "SELL" | "NEUTRAL";
  readonly strength: "VERY_STRONG" | "STRONG" | "MODERATE" | "WEAK" | "VERY_WEAK";
  readonly components: {
    readonly percentB: number;
    readonly bollingerWidth: number;
    readonly distanceFromMA: number;
    readonly keltnerWidth: number;
  };
}

// Strength classification
const classifyStrength = Match.type<number>().pipe(
  Match.when(
    (v) => v > 80,
    () => "VERY_STRONG" as const
  ),
  Match.when(
    (v) => v > 60,
    () => "STRONG" as const
  ),
  Match.when(
    (v) => v > 40,
    () => "MODERATE" as const
  ),
  Match.when(
    (v) => v > 20,
    () => "WEAK" as const
  ),
  Match.orElse(() => "VERY_WEAK" as const)
);

// Direction classification
const classifyDirection = Match.type<{ pctB: number; distMA: number }>().pipe(
  Match.when(
    ({ pctB, distMA }) => pctB < 0.2 || distMA < -5,
    () => "BUY" as const
  ),
  Match.when(
    ({ pctB, distMA }) => pctB > 0.8 || distMA > 5,
    () => "SELL" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Calculate Mean Reversion Score
export const calculateMeanReversionScore = (price: CryptoPrice): MeanReversionScoreResult => {
  const pctB = calculatePctB(price);
  const bbWidth = calculateBBWidth(price);
  const distMA = calculateDistanceFromMA(price);
  const kcWidth = calculateKeltnerWidth(price);

  // Component scores (0-100)
  const pctBScore = pctB.value > 1 || pctB.value < 0 ? 100 : Math.abs(pctB.value - 0.5) * 200;
  const bbWidthScore = Match.value(bbWidth.squeeze).pipe(
    Match.when("TIGHT", () => 100),
    Match.when("MODERATE", () => 70),
    Match.orElse(() => 40)
  );
  const distMAScore = Math.min(Math.abs(distMA.distance) * 5, 100);
  const kcWidthScore = Match.value(kcWidth.volatility).pipe(
    Match.when("VERY_LOW", () => 100),
    Match.when("LOW", () => 70),
    Match.orElse(() => 40)
  );

  const score = pctBScore * 0.3 + bbWidthScore * 0.25 + distMAScore * 0.25 + kcWidthScore * 0.2;

  return {
    score: Math.round(score),
    direction: classifyDirection({ pctB: pctB.value, distMA: distMA.distance }),
    strength: classifyStrength(score),
    components: {
      percentB: Math.round(pctBScore),
      bollingerWidth: Math.round(bbWidthScore),
      distanceFromMA: Math.round(distMAScore),
      keltnerWidth: Math.round(kcWidthScore),
    },
  };
};

// Effect-based wrapper
export const computeMeanReversionScore = (
  price: CryptoPrice
): Effect.Effect<MeanReversionScoreResult> => Effect.sync(() => calculateMeanReversionScore(price));

export const MeanReversionScoreMetadata: FormulaMetadata = {
  name: "MeanReversionScore",
  category: "composite",
  difficulty: "advanced",
  description: "Mean Reversion Score - composite mean reversion signal",
  requiredInputs: ["price", "high24h", "low24h"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "MeanReversionScoreResult",
  useCases: [
    "mean reversion trading",
    "reversal opportunity identification",
    "composite signal generation",
    "trading strategy optimization",
  ],
  timeComplexity: "O(1)",
  dependencies: ["PercentB", "BollingerWidth", "DistanceFromMA", "KeltnerWidth"],
};
