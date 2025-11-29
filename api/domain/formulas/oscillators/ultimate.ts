/** Ultimate Oscillator - Multi-timeframe momentum with functional patterns */
// UO = 100 * [(4 * Avg7) + (2 * Avg14) + Avg28] / 7

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface UltimateOscillatorResult {
  readonly value: number;
  readonly signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  readonly trend: "BULLISH" | "BEARISH" | "NEUTRAL";
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (v) => v > 70,
    () => "OVERBOUGHT" as const
  ),
  Match.when(
    (v) => v < 30,
    () => "OVERSOLD" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Trend classification
const classifyTrend = Match.type<number>().pipe(
  Match.when(
    (v) => v > 50,
    () => "BULLISH" as const
  ),
  Match.when(
    (v) => v < 50,
    () => "BEARISH" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Round to 2 decimal places
const round2 = (n: number): number => Math.round(n * 100) / 100;

// BP and TR data point
interface BPTRPoint {
  readonly bp: number;
  readonly tr: number;
}

// Calculate buying pressure and true range using Arr.zipWith
const calculateBPandTR = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>
): ReadonlyArray<BPTRPoint> =>
  pipe(
    Arr.zipWith(
      Arr.zip(Arr.drop(highs, 1), Arr.drop(lows, 1)),
      Arr.zip(Arr.drop(closes, 1), Arr.dropRight(closes, 1)),
      ([high, low], [close, prevClose]) => ({
        bp: close - Math.min(low, prevClose),
        tr: Math.max(high, prevClose) - Math.min(low, prevClose),
      })
    )
  );

// Calculate average for a period
const calculateAverage = (data: ReadonlyArray<BPTRPoint>, period: number): number => {
  const recent = Arr.takeRight(data, period);
  const sumBP = pipe(
    recent,
    Arr.reduce(0, (acc, d) => acc + d.bp)
  );
  const sumTR = pipe(
    recent,
    Arr.reduce(0, (acc, d) => acc + d.tr)
  );
  return sumTR === 0 ? 0 : sumBP / sumTR;
};

// Calculate UO value
const calculateUOValue = (avg1: number, avg2: number, avg3: number): number =>
  (100 * (4 * avg1 + 2 * avg2 + avg3)) / 7;

// Calculate Ultimate Oscillator
export const calculateUltimateOscillator = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period1: number = 7,
  period2: number = 14,
  period3: number = 28
): UltimateOscillatorResult => {
  const bptrData = calculateBPandTR(highs, lows, closes);
  const avg1 = calculateAverage(bptrData, period1);
  const avg2 = calculateAverage(bptrData, period2);
  const avg3 = calculateAverage(bptrData, period3);
  const uo = calculateUOValue(avg1, avg2, avg3);

  return {
    value: round2(uo),
    signal: classifySignal(uo),
    trend: classifyTrend(uo),
  };
};

// Calculate UO series using Arr.makeBy
export const calculateUltimateOscillatorSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period1: number = 7,
  period2: number = 14,
  period3: number = 28
): ReadonlyArray<number> => {
  const bptrData = calculateBPandTR(highs, lows, closes);

  // Calculate window average
  const windowAverage = (data: ReadonlyArray<BPTRPoint>, start: number, period: number): number => {
    const window = Arr.take(Arr.drop(data, start), period);
    const sumBP = pipe(
      window,
      Arr.reduce(0, (acc, d) => acc + d.bp)
    );
    const sumTR = pipe(
      window,
      Arr.reduce(0, (acc, d) => acc + d.tr)
    );
    return sumTR === 0 ? 0 : sumBP / sumTR;
  };

  return pipe(
    Arr.makeBy(bptrData.length - period3 + 1, (i) => {
      const idx = i + period3 - 1;
      const avg1 = windowAverage(bptrData, idx - period1 + 1, period1);
      const avg2 = windowAverage(bptrData, idx - period2 + 1, period2);
      const avg3 = windowAverage(bptrData, idx - period3 + 1, period3);
      return calculateUOValue(avg1, avg2, avg3);
    })
  );
};

// Effect-based wrapper
export const computeUltimateOscillator = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period1: number = 7,
  period2: number = 14,
  period3: number = 28
): Effect.Effect<UltimateOscillatorResult> =>
  Effect.sync(() => calculateUltimateOscillator(highs, lows, closes, period1, period2, period3));

export const UltimateOscillatorMetadata: FormulaMetadata = {
  name: "UltimateOscillator",
  category: "oscillators",
  difficulty: "intermediate",
  description: "Ultimate Oscillator - multi-timeframe momentum indicator",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period1", "period2", "period3"],
  minimumDataPoints: 29,
  outputType: "UltimateOscillatorResult",
  useCases: [
    "overbought/oversold detection",
    "divergence analysis",
    "multi-timeframe confirmation",
    "reduced false signals",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
