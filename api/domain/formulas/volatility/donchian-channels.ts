/** Donchian Channels - Breakout indicator with functional patterns */
// Upper = Highest High(N), Lower = Lowest Low(N), Middle = (Upper + Lower) / 2

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface DonchianChannelsResult {
  readonly upper: number;
  readonly middle: number;
  readonly lower: number;
  readonly width: number;
  readonly position: number;
  readonly signal: "BULLISH_BREAKOUT" | "BEARISH_BREAKOUT" | "NEUTRAL";
}

// Signal classification
const classifySignal = Match.type<{ price: number; upper: number; lower: number }>().pipe(
  Match.when(
    ({ price, upper }) => price >= upper,
    () => "BULLISH_BREAKOUT" as const
  ),
  Match.when(
    ({ price, lower }) => price <= lower,
    () => "BEARISH_BREAKOUT" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Round helpers
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

// Calculate Donchian Channels
export const calculateDonchianChannels = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 20
): DonchianChannelsResult => {
  const recentHighs = Arr.takeRight(highs, period);
  const recentLows = Arr.takeRight(lows, period);
  const upper = Math.max(...recentHighs);
  const lower = Math.min(...recentLows);
  const middle = (upper + lower) / 2;
  const width = ((upper - lower) / middle) * 100;
  const currentPrice = closes[closes.length - 1];
  const position = (currentPrice - lower) / (upper - lower);

  return {
    upper: round2(upper),
    middle: round2(middle),
    lower: round2(lower),
    width: round2(width),
    position: round3(position),
    signal: classifySignal({ price: currentPrice, upper, lower }),
  };
};

// Calculate Donchian series using Arr.makeBy
export const calculateDonchianChannelsSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 20
): {
  readonly upper: ReadonlyArray<number>;
  readonly middle: ReadonlyArray<number>;
  readonly lower: ReadonlyArray<number>;
} => {
  const results = pipe(
    Arr.makeBy(highs.length - period + 1, (i) => {
      const windowHighs = Arr.take(Arr.drop(highs, i), period);
      const windowLows = Arr.take(Arr.drop(lows, i), period);
      const upper = Math.max(...windowHighs);
      const lower = Math.min(...windowLows);
      return { upper, middle: (upper + lower) / 2, lower };
    })
  );

  return {
    upper: Arr.map(results, (r) => r.upper),
    middle: Arr.map(results, (r) => r.middle),
    lower: Arr.map(results, (r) => r.lower),
  };
};

// Effect-based wrapper
export const computeDonchianChannels = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 20
): Effect.Effect<DonchianChannelsResult> =>
  Effect.sync(() => calculateDonchianChannels(highs, lows, closes, period));

export const DonchianChannelsMetadata: FormulaMetadata = {
  name: "DonchianChannels",
  category: "volatility",
  difficulty: "beginner",
  description: "Donchian Channels - highest high and lowest low over a period",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period"],
  minimumDataPoints: 20,
  outputType: "DonchianChannelsResult",
  useCases: [
    "breakout detection",
    "trend following",
    "support/resistance levels",
    "volatility measurement",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
