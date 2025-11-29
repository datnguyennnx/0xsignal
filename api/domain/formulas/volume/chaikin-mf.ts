/** Chaikin Money Flow (CMF) - Volume-Weighted Accumulation/Distribution */
// CMF = Σ(MFM × Volume) / Σ(Volume), oscillates -1 to +1

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface ChaikinMFResult {
  readonly value: number;
  readonly signal: "STRONG_BUYING" | "BUYING" | "NEUTRAL" | "SELLING" | "STRONG_SELLING";
  readonly pressure: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (c) => c > 0.25,
    () => "STRONG_BUYING" as const
  ),
  Match.when(
    (c) => c > 0,
    () => "BUYING" as const
  ),
  Match.when(
    (c) => c < -0.25,
    () => "STRONG_SELLING" as const
  ),
  Match.when(
    (c) => c < 0,
    () => "SELLING" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Pressure classification
const classifyPressure = Match.type<number>().pipe(
  Match.when(
    (c) => c > 0.05,
    () => "ACCUMULATION" as const
  ),
  Match.when(
    (c) => c < -0.05,
    () => "DISTRIBUTION" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Money Flow Multiplier
const calcMFM = (high: number, low: number, close: number): number => {
  const range = high - low;
  return range === 0 ? 0 : (close - low - (high - close)) / range;
};

// Safe division
const safeDivide = (num: number, denom: number): number => (denom === 0 ? 0 : num / denom);

// Calculate Chaikin Money Flow
export const calculateChaikinMF = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 21
): ChaikinMFResult => {
  const startIdx = Math.max(0, closes.length - period);
  const { sumMFV, sumVolume } = closes.slice(startIdx).reduce(
    (acc, close, i) => {
      const idx = startIdx + i;
      const mfv = calcMFM(highs[idx], lows[idx], close) * volumes[idx];
      return { sumMFV: acc.sumMFV + mfv, sumVolume: acc.sumVolume + volumes[idx] };
    },
    { sumMFV: 0, sumVolume: 0 }
  );

  const cmf = safeDivide(sumMFV, sumVolume);

  return {
    value: Math.round(cmf * 1000) / 1000,
    signal: classifySignal(cmf),
    pressure: classifyPressure(cmf),
  };
};

// Calculate CMF series
export const calculateChaikinMFSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 21
): ReadonlyArray<number> =>
  Array.from({ length: closes.length - period + 1 }, (_, idx) => {
    const i = idx + period - 1;
    const { sumMFV, sumVolume } = Array.from({ length: period }, (_, j) => {
      const k = i - period + 1 + j;
      return { mfv: calcMFM(highs[k], lows[k], closes[k]) * volumes[k], vol: volumes[k] };
    }).reduce(
      (acc, { mfv, vol }) => ({ sumMFV: acc.sumMFV + mfv, sumVolume: acc.sumVolume + vol }),
      { sumMFV: 0, sumVolume: 0 }
    );
    return safeDivide(sumMFV, sumVolume);
  });

// Effect-based wrapper
export const computeChaikinMF = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 21
): Effect.Effect<ChaikinMFResult> =>
  Effect.sync(() => calculateChaikinMF(highs, lows, closes, volumes, period));

export const ChaikinMFMetadata: FormulaMetadata = {
  name: "ChaikinMF",
  category: "volume",
  difficulty: "intermediate",
  description: "Chaikin Money Flow - volume-weighted accumulation/distribution oscillator",
  requiredInputs: ["highs", "lows", "closes", "volumes"],
  optionalInputs: ["period"],
  minimumDataPoints: 21,
  outputType: "ChaikinMFResult",
  useCases: [
    "buying/selling pressure measurement",
    "trend confirmation",
    "divergence detection",
    "accumulation/distribution analysis",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
