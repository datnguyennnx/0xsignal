/** VWAP (Volume Weighted Average Price) - Intraday Benchmark */
// VWAP = Σ(Typical Price × Volume) / Σ(Volume)

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface VWAPResult {
  readonly value: number;
  readonly position: "ABOVE" | "BELOW" | "AT";
  readonly deviation: number;
}

// Position classification
const classifyPosition = (price: number, vwap: number): "ABOVE" | "BELOW" | "AT" =>
  Match.value(price / vwap).pipe(
    Match.when(
      (r) => r > 1.001,
      () => "ABOVE" as const
    ),
    Match.when(
      (r) => r < 0.999,
      () => "BELOW" as const
    ),
    Match.orElse(() => "AT" as const)
  );

// Typical price
const typicalPrice = (high: number, low: number, close: number): number => (high + low + close) / 3;

// Safe division
const safeDivide = (num: number, denom: number): number => (denom === 0 ? 0 : num / denom);

// Calculate VWAP
export const calculateVWAP = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): VWAPResult => {
  const { cumulativePV, cumulativeVolume } = closes.reduce(
    (acc, close, i) => {
      const tp = typicalPrice(highs[i], lows[i], close);
      return {
        cumulativePV: acc.cumulativePV + tp * volumes[i],
        cumulativeVolume: acc.cumulativeVolume + volumes[i],
      };
    },
    { cumulativePV: 0, cumulativeVolume: 0 }
  );

  const vwap = safeDivide(cumulativePV, cumulativeVolume);
  const currentPrice = closes[closes.length - 1];
  const deviation = safeDivide(currentPrice - vwap, vwap) * 100;

  return {
    value: Math.round(vwap * 100) / 100,
    position: classifyPosition(currentPrice, vwap),
    deviation: Math.round(deviation * 100) / 100,
  };
};

// Calculate VWAP series
export const calculateVWAPSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): ReadonlyArray<number> =>
  closes.reduce<{ series: number[]; cumPV: number; cumVol: number }>(
    (acc, close, i) => {
      const tp = typicalPrice(highs[i], lows[i], close);
      const cumPV = acc.cumPV + tp * volumes[i];
      const cumVol = acc.cumVol + volumes[i];
      return {
        series: [...acc.series, safeDivide(cumPV, cumVol)],
        cumPV,
        cumVol,
      };
    },
    { series: [], cumPV: 0, cumVol: 0 }
  ).series;

// Effect-based wrapper
export const computeVWAP = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): Effect.Effect<VWAPResult> => Effect.sync(() => calculateVWAP(highs, lows, closes, volumes));

export const VWAPMetadata: FormulaMetadata = {
  name: "VWAP",
  category: "volume",
  difficulty: "intermediate",
  description: "Volume Weighted Average Price - volume-weighted benchmark",
  requiredInputs: ["highs", "lows", "closes", "volumes"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "VWAPResult",
  useCases: [
    "execution benchmark",
    "support/resistance levels",
    "institutional trading reference",
    "mean reversion trading",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
