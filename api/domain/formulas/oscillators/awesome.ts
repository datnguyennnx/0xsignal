/** Awesome Oscillator (AO) - Momentum using midpoint SMAs with functional patterns */
// AO = SMA(Midpoint, 5) - SMA(Midpoint, 34), Midpoint = (High + Low) / 2

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateSMA } from "../trend/moving-averages";

export interface AwesomeOscillatorResult {
  readonly value: number;
  readonly signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  readonly momentum: "INCREASING" | "DECREASING" | "STABLE";
  readonly histogram: "GREEN" | "RED";
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (v) => v > 0,
    () => "BULLISH" as const
  ),
  Match.when(
    (v) => v < 0,
    () => "BEARISH" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Momentum classification
const classifyMomentum = Match.type<number>().pipe(
  Match.when(
    (v) => v > 0,
    () => "INCREASING" as const
  ),
  Match.when(
    (v) => v < 0,
    () => "DECREASING" as const
  ),
  Match.orElse(() => "STABLE" as const)
);

// Round to 2 decimal places
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Calculate midpoints using Arr.zipWith
const calculateMidpoints = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>
): ReadonlyArray<number> => Arr.zipWith(highs, lows, (h, l) => (h + l) / 2);

// Calculate window average
const windowAverage = (arr: ReadonlyArray<number>, period: number): number =>
  pipe(
    Arr.takeRight(arr, period),
    Arr.reduce(0, (a, b) => a + b)
  ) / period;

// Calculate Awesome Oscillator
export const calculateAwesomeOscillator = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  fastPeriod: number = 5,
  slowPeriod: number = 34
): AwesomeOscillatorResult => {
  const midpoints = calculateMidpoints(highs, lows);
  const fastSMA = calculateSMA(Arr.takeRight(midpoints, fastPeriod), fastPeriod).value;
  const slowSMA = calculateSMA(Arr.takeRight(midpoints, slowPeriod), slowPeriod).value;
  const ao = fastSMA - slowSMA;

  // Calculate momentum change
  const momentumDelta =
    midpoints.length > slowPeriod
      ? pipe(Arr.dropRight(midpoints, 1), (prevMidpoints) => {
          const prevFastSMA = calculateSMA(
            Arr.takeRight(prevMidpoints, fastPeriod),
            fastPeriod
          ).value;
          const prevSlowSMA = calculateSMA(
            Arr.takeRight(prevMidpoints, slowPeriod),
            slowPeriod
          ).value;
          return ao - (prevFastSMA - prevSlowSMA);
        })
      : 0;

  const momentum = classifyMomentum(momentumDelta);

  return {
    value: round2(ao),
    signal: classifySignal(ao),
    momentum,
    histogram: momentum === "INCREASING" ? "GREEN" : "RED",
  };
};

// Calculate AO series using Arr.makeBy
export const calculateAwesomeOscillatorSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  fastPeriod: number = 5,
  slowPeriod: number = 34
): ReadonlyArray<number> => {
  const midpoints = calculateMidpoints(highs, lows);

  return pipe(
    Arr.makeBy(midpoints.length - slowPeriod + 1, (i) => {
      const idx = i + slowPeriod - 1;
      const fastWindow = Arr.take(Arr.drop(midpoints, idx - fastPeriod + 1), fastPeriod);
      const slowWindow = Arr.take(Arr.drop(midpoints, idx - slowPeriod + 1), slowPeriod);
      const fastAvg =
        pipe(
          fastWindow,
          Arr.reduce(0, (a, b) => a + b)
        ) / fastPeriod;
      const slowAvg =
        pipe(
          slowWindow,
          Arr.reduce(0, (a, b) => a + b)
        ) / slowPeriod;
      return fastAvg - slowAvg;
    })
  );
};

// Effect-based wrapper
export const computeAwesomeOscillator = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  fastPeriod: number = 5,
  slowPeriod: number = 34
): Effect.Effect<AwesomeOscillatorResult> =>
  Effect.sync(() => calculateAwesomeOscillator(highs, lows, fastPeriod, slowPeriod));

export const AwesomeOscillatorMetadata: FormulaMetadata = {
  name: "AwesomeOscillator",
  category: "oscillators",
  difficulty: "intermediate",
  description: "Awesome Oscillator - momentum indicator using midpoint SMAs",
  requiredInputs: ["highs", "lows"],
  optionalInputs: ["fastPeriod", "slowPeriod"],
  minimumDataPoints: 34,
  outputType: "AwesomeOscillatorResult",
  useCases: [
    "momentum measurement",
    "trend confirmation",
    "zero-line crossovers",
    "twin peaks pattern",
  ],
  timeComplexity: "O(n)",
  dependencies: ["SMA"],
};
