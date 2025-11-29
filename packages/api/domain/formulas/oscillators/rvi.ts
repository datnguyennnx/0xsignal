/** RVI (Relative Vigor Index) - Trend conviction using OHLC with functional patterns */
// RVI = SMA(Numerator) / SMA(Denominator), Signal = SMA(RVI, 4)

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateSMA } from "../trend/moving-averages";

export interface RVIResult {
  readonly rvi: number;
  readonly signal: number;
  readonly crossover: "BULLISH" | "BEARISH" | "NONE";
  readonly momentum: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
}

// Momentum classification
const classifyMomentum = Match.type<number>().pipe(
  Match.when(
    (v) => v > 0.05,
    () => "POSITIVE" as const
  ),
  Match.when(
    (v) => v < -0.05,
    () => "NEGATIVE" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Crossover classification
const classifyCrossover = Match.type<{
  prev: number;
  curr: number;
  prevSig: number;
  currSig: number;
}>().pipe(
  Match.when(
    ({ prev, curr, prevSig, currSig }) => prev <= prevSig && curr > currSig,
    () => "BULLISH" as const
  ),
  Match.when(
    ({ prev, curr, prevSig, currSig }) => prev >= prevSig && curr < currSig,
    () => "BEARISH" as const
  ),
  Match.orElse(() => "NONE" as const)
);

// Round to 3 decimal places
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

// Calculate weighted value for RVI
const calculateWeightedValue = (values: ReadonlyArray<number>, index: number): number =>
  index < 3
    ? 0
    : (values[index] + 2 * values[index - 1] + 2 * values[index - 2] + values[index - 3]) / 6;

// Numerator/Denominator data
interface NumDenData {
  readonly numerators: ReadonlyArray<number>;
  readonly denominators: ReadonlyArray<number>;
}

// Calculate numerators and denominators using Arr.makeBy
const calculateNumDen = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>
): NumDenData => {
  const closeOpen = Arr.zipWith(closes, opens, (c, o) => c - o);
  const highLow = Arr.zipWith(highs, lows, (h, l) => h - l);

  const indices = Arr.makeBy(closes.length - 3, (i) => i + 3);

  return {
    numerators: Arr.map(indices, (i) => calculateWeightedValue(closeOpen, i)),
    denominators: Arr.map(indices, (i) => calculateWeightedValue(highLow, i)),
  };
};

// Calculate RVI series from numerators and denominators
const calculateRVISeries = (
  numerators: ReadonlyArray<number>,
  denominators: ReadonlyArray<number>,
  period: number
): ReadonlyArray<number> =>
  pipe(
    Arr.makeBy(numerators.length - period + 1, (i) => {
      const numWindow = Arr.take(Arr.drop(numerators, i), period);
      const denWindow = Arr.take(Arr.drop(denominators, i), period);
      const nAvg =
        pipe(
          numWindow,
          Arr.reduce(0, (a, b) => a + b)
        ) / period;
      const dAvg =
        pipe(
          denWindow,
          Arr.reduce(0, (a, b) => a + b)
        ) / period;
      return dAvg === 0 ? 0 : nAvg / dAvg;
    })
  );

// Calculate RVI
export const calculateRVI = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 10
): RVIResult => {
  const { numerators, denominators } = calculateNumDen(opens, highs, lows, closes);
  const numSMA = calculateSMA(Arr.takeRight(numerators, period), period).value;
  const denSMA = calculateSMA(Arr.takeRight(denominators, period), period).value;
  const rvi = denSMA === 0 ? 0 : numSMA / denSMA;

  const rviSeries = calculateRVISeries(numerators, denominators, period);
  const signal = rviSeries.length >= 4 ? calculateSMA(Arr.takeRight(rviSeries, 4), 4).value : rvi;

  // Determine crossover
  const crossover: "BULLISH" | "BEARISH" | "NONE" =
    rviSeries.length >= 2
      ? pipe(
          {
            prevRVI: rviSeries[rviSeries.length - 2],
            prevSignal:
              rviSeries.length >= 5
                ? calculateSMA(Arr.take(Arr.takeRight(rviSeries, 5), 4), 4).value
                : rviSeries[rviSeries.length - 2],
          },
          ({ prevRVI, prevSignal }) =>
            classifyCrossover({
              prev: prevRVI,
              curr: rvi,
              prevSig: prevSignal,
              currSig: signal,
            })
        )
      : "NONE";

  return {
    rvi: round3(rvi),
    signal: round3(signal),
    crossover,
    momentum: classifyMomentum(rvi),
  };
};

// Effect-based wrapper
export const computeRVI = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 10
): Effect.Effect<RVIResult> => Effect.sync(() => calculateRVI(opens, highs, lows, closes, period));

export const RVIMetadata: FormulaMetadata = {
  name: "RVI",
  category: "oscillators",
  difficulty: "intermediate",
  description: "Relative Vigor Index - measures trend conviction using OHLC data",
  requiredInputs: ["opens", "highs", "lows", "closes"],
  optionalInputs: ["period"],
  minimumDataPoints: 13,
  outputType: "RVIResult",
  useCases: [
    "momentum measurement",
    "trend confirmation",
    "crossover signals",
    "divergence detection",
  ],
  timeComplexity: "O(n)",
  dependencies: ["SMA"],
};
