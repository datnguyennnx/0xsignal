/** Volume ROC (Volume Rate of Change) - Volume Momentum */
// Volume ROC = ((Current - Past) / Past) × 100

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface VolumeROCResult {
  readonly value: number;
  readonly signal: "SURGE" | "HIGH" | "NORMAL" | "LOW";
  readonly activity: "UNUSUAL" | "ELEVATED" | "NORMAL" | "QUIET";
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (v) => v > 100,
    () => "SURGE" as const
  ),
  Match.when(
    (v) => v > 50,
    () => "HIGH" as const
  ),
  Match.when(
    (v) => v > 20,
    () => "NORMAL" as const
  ),
  Match.orElse(() => "LOW" as const)
);

// Activity classification
const classifyActivity = Match.type<number>().pipe(
  Match.when(
    (v) => v > 100,
    () => "UNUSUAL" as const
  ),
  Match.when(
    (v) => v > 50,
    () => "ELEVATED" as const
  ),
  Match.when(
    (v) => v > 10,
    () => "NORMAL" as const
  ),
  Match.orElse(() => "QUIET" as const)
);

// Safe division
const safeDivide = (num: number, denom: number): number => (denom === 0 ? 0 : num / denom);

// Calculate Volume ROC
export const calculateVolumeROC = (
  volumes: ReadonlyArray<number>,
  period: number = 14
): VolumeROCResult => {
  const currentVolume = volumes[volumes.length - 1];
  const pastVolume = volumes[volumes.length - 1 - period] ?? volumes[0];
  const value = safeDivide(currentVolume - pastVolume, pastVolume) * 100;
  const absValue = Math.abs(value);

  return {
    value: Math.round(value * 100) / 100,
    signal: classifySignal(absValue),
    activity: classifyActivity(absValue),
  };
};

// Calculate Volume ROC series
export const calculateVolumeROCSeries = (
  volumes: ReadonlyArray<number>,
  period: number = 14
): ReadonlyArray<number> =>
  volumes.slice(period).map((vol, i) => {
    const pastVolume = volumes[i];
    return safeDivide(vol - pastVolume, pastVolume) * 100;
  });

// Effect-based wrapper
export const computeVolumeROC = (
  volumes: ReadonlyArray<number>,
  period: number = 14
): Effect.Effect<VolumeROCResult> => Effect.sync(() => calculateVolumeROC(volumes, period));

export const VolumeROCMetadata: FormulaMetadata = {
  name: "VolumeROC",
  category: "volume",
  difficulty: "intermediate",
  description: "Volume Rate of Change - volume momentum indicator",
  requiredInputs: ["volumes"],
  optionalInputs: ["period"],
  minimumDataPoints: 15,
  outputType: "VolumeROCResult",
  useCases: [
    "volume surge detection",
    "unusual activity identification",
    "breakout confirmation",
    "trend strength validation",
  ],
  timeComplexity: "O(1)",
  dependencies: [],
};
