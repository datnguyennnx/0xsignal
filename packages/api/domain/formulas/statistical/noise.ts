/** Noise Score - Signal Quality Measurement */
// Combines ADX, ATR, and indicator agreement to measure signal reliability

import { Effect, Match, Option } from "effect";
import type { FormulaMetadata } from "../core/types";
import type { NoiseScore } from "@0xsignal/shared";

// Noise level classification
const classifyNoiseLevel = Match.type<number>().pipe(
  Match.when(
    (n) => n < 30,
    () => "LOW" as const
  ),
  Match.when(
    (n) => n < 55,
    () => "MODERATE" as const
  ),
  Match.when(
    (n) => n < 75,
    () => "HIGH" as const
  ),
  Match.orElse(() => "EXTREME" as const)
);

// ATR noise contribution using Match
const calcAtrNoise = Match.type<number>().pipe(
  Match.when(
    (atr) => atr < 1,
    () => 40
  ),
  Match.when(
    (atr) => atr > 6,
    (atr) => Math.min(100, 40 + (atr - 6) * 10)
  ),
  Match.when(
    (atr) => atr > 4,
    (atr) => (atr - 4) * 20
  ),
  Match.orElse(() => 0)
);

// Clamp value to range
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Calculate noise score from market indicators
export const calculateNoiseScore = (
  adx: number,
  normalizedATR: number,
  indicatorAgreement?: number
): NoiseScore => {
  // ADX contribution: low ADX = high noise
  const adxNoise = clamp((35 - adx) * 2.85, 0, 100);

  // ATR contribution: extreme volatility = high noise
  const atrNoise = calcAtrNoise(normalizedATR);

  // Agreement contribution using Option
  const { agreementNoise, weights } = Option.fromNullable(indicatorAgreement).pipe(
    Option.map((agreement) => ({
      agreementNoise: Math.max(0, (0.6 - agreement) * 166),
      weights: [0.4, 0.3, 0.3] as const,
    })),
    Option.getOrElse(() => ({
      agreementNoise: 35,
      weights: [0.55, 0.45, 0] as const,
    }))
  );

  const noiseValue = Math.round(
    adxNoise * weights[0] + atrNoise * weights[1] + agreementNoise * weights[2]
  );

  const clampedNoise = clamp(noiseValue, 0, 100);

  return {
    score: clampedNoise,
    value: clampedNoise,
    level: classifyNoiseLevel(clampedNoise),
  };
};

// Effect-based wrapper
export const computeNoiseScore = (
  adx: number,
  normalizedATR: number,
  priceEfficiency?: number
): Effect.Effect<NoiseScore> =>
  Effect.sync(() => calculateNoiseScore(adx, normalizedATR, priceEfficiency));

export const NoiseScoreMetadata: FormulaMetadata = {
  name: "NoiseScore",
  category: "statistical",
  difficulty: "intermediate",
  description: "Noise Score - measures signal clarity vs market randomness",
  requiredInputs: ["adx", "normalizedATR"],
  optionalInputs: ["priceEfficiency"],
  minimumDataPoints: 1,
  outputType: "NoiseScore",
  useCases: [
    "signal quality assessment",
    "trade filtering",
    "position sizing",
    "market regime detection",
  ],
  timeComplexity: "O(1)",
  dependencies: ["ADX", "ATR"],
};
