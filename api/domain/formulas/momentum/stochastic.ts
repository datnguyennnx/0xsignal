/** Stochastic Oscillator - Momentum Analysis */
// %K = 100 * (Close - LowestLow) / (HighestHigh - LowestLow), %D = SMA(%K)

import { Effect, Match, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

export interface StochasticResult {
  readonly k: number;
  readonly d: number;
  readonly signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  readonly crossover: "BULLISH" | "BEARISH" | "NONE";
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (k) => k > 80,
    () => "OVERBOUGHT" as const
  ),
  Match.when(
    (k) => k < 20,
    () => "OVERSOLD" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Crossover detection
const detectCrossover = (
  prevK: number,
  prevD: number,
  k: number,
  d: number
): "BULLISH" | "BEARISH" | "NONE" =>
  pipe(
    Match.value({ prevK, prevD, k, d }),
    Match.when(
      ({ prevK, prevD, k, d }) => prevK <= prevD && k > d,
      () => "BULLISH" as const
    ),
    Match.when(
      ({ prevK, prevD, k, d }) => prevK >= prevD && k < d,
      () => "BEARISH" as const
    ),
    Match.orElse(() => "NONE" as const)
  );

// Safe %K calculation
const calcK = (close: number, lowestLow: number, highestHigh: number): number => {
  const range = highestHigh - lowestLow;
  return range === 0 ? 50 : ((close - lowestLow) / range) * 100;
};

// Calculate %K for a window
const calcKForWindow = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  index: number,
  kPeriod: number
): number => {
  const windowHighs = highs.slice(index - kPeriod + 1, index + 1);
  const windowLows = lows.slice(index - kPeriod + 1, index + 1);
  return calcK(closes[index], Math.min(...windowLows), Math.max(...windowHighs));
};

// Calculate Stochastic Oscillator
export const calculateStochastic = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticResult => {
  const recentHighs = highs.slice(-kPeriod);
  const recentLows = lows.slice(-kPeriod);
  const currentClose = closes[closes.length - 1];

  const k = calcK(currentClose, Math.min(...recentLows), Math.max(...recentHighs));

  // Calculate %K series for %D
  const kSeries = Array.from({ length: closes.length - kPeriod + 1 }, (_, i) =>
    calcKForWindow(closes, highs, lows, i + kPeriod - 1, kPeriod)
  );

  const d = mean(kSeries.slice(-dPeriod));

  // Determine crossover
  const crossover =
    kSeries.length >= 2
      ? detectCrossover(kSeries[kSeries.length - 2], mean(kSeries.slice(-dPeriod - 1, -1)), k, d)
      : ("NONE" as const);

  return {
    k: Math.round(k * 100) / 100,
    d: Math.round(d * 100) / 100,
    signal: classifySignal(k),
    crossover,
  };
};

// Calculate Stochastic series
export const calculateStochasticSeries = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  kPeriod: number = 14,
  dPeriod: number = 3
): { readonly k: ReadonlyArray<number>; readonly d: ReadonlyArray<number> } => {
  const kSeries = Array.from({ length: closes.length - kPeriod + 1 }, (_, i) =>
    calcKForWindow(closes, highs, lows, i + kPeriod - 1, kPeriod)
  );

  const dSeries = Array.from({ length: kSeries.length - dPeriod + 1 }, (_, i) =>
    mean(kSeries.slice(i, i + dPeriod))
  );

  return { k: kSeries, d: dSeries };
};

// Effect-based wrapper
export const computeStochastic = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  kPeriod: number = 14,
  dPeriod: number = 3
): Effect.Effect<StochasticResult> =>
  Effect.sync(() => calculateStochastic(closes, highs, lows, kPeriod, dPeriod));

export const StochasticMetadata: FormulaMetadata = {
  name: "Stochastic",
  category: "momentum",
  difficulty: "beginner",
  description: "Stochastic Oscillator - measures position relative to high-low range",
  requiredInputs: ["closes", "highs", "lows"],
  optionalInputs: ["kPeriod", "dPeriod"],
  minimumDataPoints: 17,
  outputType: "StochasticResult",
  useCases: [
    "overbought/oversold detection",
    "momentum analysis",
    "crossover signals",
    "divergence detection",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
