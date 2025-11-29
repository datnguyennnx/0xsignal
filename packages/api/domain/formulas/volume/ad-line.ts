/** A/D Line (Accumulation/Distribution) - Volume Flow Indicator */
// MFM = ((Close - Low) - (High - Close)) / (High - Low), A/D = Σ(MFM × Volume)

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface ADLineResult {
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

// Money Flow Multiplier
const calcMFM = (high: number, low: number, close: number): number => {
  const range = high - low;
  return range === 0 ? 0 : (close - low - (high - close)) / range;
};

// Safe division
const safeDivide = (num: number, denom: number): number => (denom === 0 ? 0 : num / denom);

// Calculate A/D Line
export const calculateADLine = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): ADLineResult => {
  const adSeries = closes.reduce<number[]>((acc, close, i) => {
    const prev = acc[acc.length - 1] ?? 0;
    const mfv = calcMFM(highs[i], lows[i], close) * volumes[i];
    return [...acc, prev + mfv];
  }, []);

  const recentAD = adSeries.slice(-10);
  const adChange = (recentAD[recentAD.length - 1] ?? 0) - (recentAD[0] ?? 0);
  const lastTwo = adSeries.slice(-2);
  const momentum =
    safeDivide((lastTwo[1] ?? 0) - (lastTwo[0] ?? 0), Math.abs(lastTwo[0] ?? 1)) * 100;

  return {
    value: Math.round(adSeries[adSeries.length - 1] ?? 0),
    trend: classifyTrend(adChange),
    momentum: Math.round(momentum * 100) / 100,
  };
};

// Calculate A/D Line series
export const calculateADLineSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): ReadonlyArray<number> =>
  closes.reduce<number[]>((acc, close, i) => {
    const prev = acc[acc.length - 1] ?? 0;
    const mfv = calcMFM(highs[i], lows[i], close) * volumes[i];
    return [...acc, prev + mfv];
  }, []);

// Effect-based wrapper
export const computeADLine = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): Effect.Effect<ADLineResult> => Effect.sync(() => calculateADLine(highs, lows, closes, volumes));

export const ADLineMetadata: FormulaMetadata = {
  name: "ADLine",
  category: "volume",
  difficulty: "intermediate",
  description: "Accumulation/Distribution Line - volume flow indicator",
  requiredInputs: ["highs", "lows", "closes", "volumes"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "ADLineResult",
  useCases: [
    "accumulation/distribution analysis",
    "divergence detection",
    "trend confirmation",
    "money flow tracking",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
