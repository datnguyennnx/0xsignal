/** Williams %R - Momentum oscillator with functional patterns */
// %R = -100 * (Highest High - Close) / (Highest High - Lowest Low)

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface WilliamsRResult {
  readonly value: number;
  readonly signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  readonly momentum: "BULLISH" | "BEARISH" | "NEUTRAL";
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (v) => v > -20,
    () => "OVERBOUGHT" as const
  ),
  Match.when(
    (v) => v < -80,
    () => "OVERSOLD" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Momentum classification
const classifyMomentum = Match.type<number>().pipe(
  Match.when(
    (v) => v > -50,
    () => "BULLISH" as const
  ),
  Match.when(
    (v) => v < -50,
    () => "BEARISH" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Round to 2 decimal places
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Calculate Williams %R value
const calculateWilliamsRValue = (close: number, highestHigh: number, lowestLow: number): number => {
  const range = highestHigh - lowestLow;
  return range === 0 ? -50 : -100 * ((highestHigh - close) / range);
};

// Calculate Williams %R
export const calculateWilliamsR = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 14
): WilliamsRResult => {
  const recentHighs = Arr.takeRight(highs, period);
  const recentLows = Arr.takeRight(lows, period);
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const currentClose = closes[closes.length - 1];
  const value = calculateWilliamsRValue(currentClose, highestHigh, lowestLow);

  return {
    value: round2(value),
    signal: classifySignal(value),
    momentum: classifyMomentum(value),
  };
};

// Calculate Williams %R series using Arr.makeBy
export const calculateWilliamsRSeries = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 14
): ReadonlyArray<number> =>
  pipe(
    Arr.makeBy(closes.length - period + 1, (i) => {
      const idx = i + period - 1;
      const windowHighs = Arr.take(Arr.drop(highs, i), period);
      const windowLows = Arr.take(Arr.drop(lows, i), period);
      const hh = Math.max(...windowHighs);
      const ll = Math.min(...windowLows);
      return calculateWilliamsRValue(closes[idx], hh, ll);
    })
  );

// Effect-based wrapper
export const computeWilliamsR = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 14
): Effect.Effect<WilliamsRResult> =>
  Effect.sync(() => calculateWilliamsR(closes, highs, lows, period));

export const WilliamsRMetadata: FormulaMetadata = {
  name: "WilliamsR",
  category: "momentum",
  difficulty: "beginner",
  description: "Williams %R - momentum oscillator measuring overbought/oversold levels",
  requiredInputs: ["closes", "highs", "lows"],
  optionalInputs: ["period"],
  minimumDataPoints: 14,
  outputType: "WilliamsRResult",
  useCases: [
    "overbought/oversold detection",
    "momentum analysis",
    "reversal signals",
    "divergence detection",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
