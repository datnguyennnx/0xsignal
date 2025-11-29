/** OBV (On-Balance Volume) - Volume Momentum Indicator */
// Cumulative volume: adds on up days, subtracts on down days

import { Effect, Match, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface OBVResult {
  readonly value: number;
  readonly trend: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  readonly momentum: number;
}

// Trend classification
const classifyTrend = Match.type<number>().pipe(
  Match.when(
    (c) => c > 0,
    () => "ACCUMULATION" as const
  ),
  Match.when(
    (c) => c < 0,
    () => "DISTRIBUTION" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Volume contribution based on price direction
const volumeContribution = (priceDiff: number, volume: number): number =>
  pipe(
    Match.value(priceDiff),
    Match.when(
      (d) => d > 0,
      () => volume
    ),
    Match.when(
      (d) => d < 0,
      () => -volume
    ),
    Match.orElse(() => 0)
  );

// Safe division
const safeDivide = (num: number, denom: number): number => (denom === 0 ? 0 : num / denom);

// Calculate OBV
export const calculateOBV = (
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): OBVResult => {
  const obvSeries = closes.reduce<number[]>((acc, close, i) => {
    const prev = acc[acc.length - 1] ?? 0;
    const contribution = i === 0 ? 0 : volumeContribution(close - closes[i - 1], volumes[i]);
    return [...acc, prev + contribution];
  }, []);

  const recentOBV = obvSeries.slice(-10);
  const obvChange = (recentOBV[recentOBV.length - 1] ?? 0) - (recentOBV[0] ?? 0);
  const lastTwo = obvSeries.slice(-2);
  const momentum =
    safeDivide((lastTwo[1] ?? 0) - (lastTwo[0] ?? 0), Math.abs(lastTwo[0] ?? 1)) * 100;

  return {
    value: Math.round(obvSeries[obvSeries.length - 1] ?? 0),
    trend: classifyTrend(obvChange),
    momentum: Math.round(momentum * 100) / 100,
  };
};

// Calculate OBV series
export const calculateOBVSeries = (
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): ReadonlyArray<number> =>
  closes.reduce<number[]>((acc, close, i) => {
    const prev = acc[acc.length - 1] ?? 0;
    const contribution = i === 0 ? 0 : volumeContribution(close - closes[i - 1], volumes[i]);
    return [...acc, prev + contribution];
  }, []);

// Effect-based wrapper
export const computeOBV = (
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): Effect.Effect<OBVResult> => Effect.sync(() => calculateOBV(closes, volumes));

export const OBVMetadata: FormulaMetadata = {
  name: "OBV",
  category: "volume",
  difficulty: "intermediate",
  description: "On-Balance Volume - cumulative volume momentum indicator",
  requiredInputs: ["closes", "volumes"],
  optionalInputs: [],
  minimumDataPoints: 2,
  outputType: "OBVResult",
  useCases: [
    "trend confirmation",
    "divergence detection",
    "accumulation/distribution analysis",
    "volume momentum",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
