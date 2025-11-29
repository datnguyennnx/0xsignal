/** Supertrend - ATR-based trend indicator with functional patterns */
// Upper = HL2 + (multiplier * ATR), Lower = HL2 - (multiplier * ATR)

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateATR } from "../volatility/atr";

export interface SupertrendResult {
  readonly value: number;
  readonly trend: "BULLISH" | "BEARISH";
  readonly isReversal: boolean;
  readonly upperBand: number;
  readonly lowerBand: number;
}

// Round to 2 decimal places
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Determine trend from close and HL2
const determineTrend = (close: number, hl2: number): "BULLISH" | "BEARISH" =>
  Match.value(close > hl2).pipe(
    Match.when(true, () => "BULLISH" as const),
    Match.orElse(() => "BEARISH" as const)
  );

// Calculate Supertrend
export const calculateSupertrend = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 10,
  multiplier: number = 3
): SupertrendResult => {
  const atr = calculateATR(highs, lows, closes, period);
  const hl2 = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
  const basicUpperBand = hl2 + multiplier * atr.value;
  const basicLowerBand = hl2 - multiplier * atr.value;
  const currentClose = closes[closes.length - 1];
  const trend = determineTrend(currentClose, hl2);
  const value = Match.value(trend).pipe(
    Match.when("BULLISH", () => basicLowerBand),
    Match.orElse(() => basicUpperBand)
  );

  // Check for reversal
  const isReversal =
    closes.length > period + 1
      ? pipe(
          {
            prevClose: closes[closes.length - 2],
            prevHL2: (highs[highs.length - 2] + lows[lows.length - 2]) / 2,
          },
          ({ prevClose, prevHL2 }) => {
            const prevTrend = determineTrend(prevClose, prevHL2);
            return trend !== prevTrend;
          }
        )
      : false;

  return {
    value: round2(value),
    trend,
    isReversal,
    upperBand: round2(basicUpperBand),
    lowerBand: round2(basicLowerBand),
  };
};

// Calculate Supertrend series using Arr.makeBy
export const calculateSupertrendSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 10,
  multiplier: number = 3
): ReadonlyArray<{ value: number; trend: "BULLISH" | "BEARISH" }> =>
  Match.value(closes.length < period + 1).pipe(
    Match.when(true, () => [] as { value: number; trend: "BULLISH" | "BEARISH" }[]),
    Match.orElse(() =>
      pipe(
        Arr.makeBy(closes.length - period, (i) => {
          const idx = i + period;
          const windowHighs = Arr.take(highs, idx + 1);
          const windowLows = Arr.take(lows, idx + 1);
          const windowCloses = Arr.take(closes, idx + 1);
          const st = calculateSupertrend(windowHighs, windowLows, windowCloses, period, multiplier);
          return { value: st.value, trend: st.trend };
        })
      )
    )
  );

// Effect-based wrapper
export const computeSupertrend = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 10,
  multiplier: number = 3
): Effect.Effect<SupertrendResult> =>
  Effect.sync(() => calculateSupertrend(highs, lows, closes, period, multiplier));

export const SupertrendMetadata: FormulaMetadata = {
  name: "Supertrend",
  category: "trend",
  difficulty: "beginner",
  description: "Supertrend - ATR-based trend following indicator",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period", "multiplier"],
  minimumDataPoints: 11,
  outputType: "SupertrendResult",
  useCases: [
    "trend identification",
    "entry/exit signals",
    "stop-loss placement",
    "trend reversal detection",
  ],
  timeComplexity: "O(n)",
  dependencies: ["ATR"],
};
