/** CCI (Commodity Channel Index) - Deviation from statistical mean */
// CCI = (Typical Price - SMA) / (0.015 * Mean Deviation)

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

export interface CCIResult {
  readonly value: number;
  readonly signal:
    | "EXTREME_OVERBOUGHT"
    | "OVERBOUGHT"
    | "NEUTRAL"
    | "OVERSOLD"
    | "EXTREME_OVERSOLD";
  readonly trend: "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_BEARISH";
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (v) => v > 200,
    () => "EXTREME_OVERBOUGHT" as const
  ),
  Match.when(
    (v) => v > 100,
    () => "OVERBOUGHT" as const
  ),
  Match.when(
    (v) => v < -200,
    () => "EXTREME_OVERSOLD" as const
  ),
  Match.when(
    (v) => v < -100,
    () => "OVERSOLD" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Trend classification
const classifyTrend = Match.type<number>().pipe(
  Match.when(
    (v) => v > 200,
    () => "STRONG_BULLISH" as const
  ),
  Match.when(
    (v) => v > 100,
    () => "BULLISH" as const
  ),
  Match.when(
    (v) => v < -200,
    () => "STRONG_BEARISH" as const
  ),
  Match.when(
    (v) => v < -100,
    () => "BEARISH" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Round to 2 decimal places
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Calculate typical prices using Arr.zipWith
const calculateTypicalPrices = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>
): ReadonlyArray<number> =>
  pipe(
    Arr.zipWith(highs, lows, (h, l) => ({ h, l })),
    Arr.zipWith(closes, ({ h, l }, c) => (h + l + c) / 3)
  );

// Calculate CCI for a window
const calculateCCIValue = (window: ReadonlyArray<number>, currentTP: number): number => {
  const sma = mean([...window]);
  const deviations = Arr.map(window, (tp) => Math.abs(tp - sma));
  const meanDeviation = mean([...deviations]);
  return meanDeviation === 0 ? 0 : (currentTP - sma) / (0.015 * meanDeviation);
};

// Calculate CCI
export const calculateCCI = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 20
): CCIResult => {
  const typicalPrices = calculateTypicalPrices(highs, lows, closes);
  const recentTP = Arr.takeRight(typicalPrices, period);
  const currentTP = typicalPrices[typicalPrices.length - 1];
  const cci = calculateCCIValue(recentTP, currentTP);

  return {
    value: round2(cci),
    signal: classifySignal(cci),
    trend: classifyTrend(cci),
  };
};

// Calculate CCI series using Arr.makeBy
export const calculateCCISeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 20
): ReadonlyArray<number> => {
  const typicalPrices = calculateTypicalPrices(highs, lows, closes);

  return pipe(
    Arr.makeBy(typicalPrices.length - period + 1, (i) => {
      const idx = i + period - 1;
      const window = Arr.take(Arr.drop(typicalPrices, i), period);
      return calculateCCIValue(window, typicalPrices[idx]);
    })
  );
};

// Effect-based wrapper
export const computeCCI = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 20
): Effect.Effect<CCIResult> => Effect.sync(() => calculateCCI(highs, lows, closes, period));

export const CCIMetadata: FormulaMetadata = {
  name: "CCI",
  category: "oscillators",
  difficulty: "intermediate",
  description: "Commodity Channel Index - measures deviation from statistical mean",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period"],
  minimumDataPoints: 20,
  outputType: "CCIResult",
  useCases: [
    "overbought/oversold detection",
    "trend identification",
    "divergence analysis",
    "cyclical turning points",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
