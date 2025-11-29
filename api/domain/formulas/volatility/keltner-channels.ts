/** Keltner Channels - EMA and ATR based channels with functional patterns */
// Middle = EMA(Close), Upper = EMA + (multiplier * ATR), Lower = EMA - (multiplier * ATR)

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateEMA } from "../trend/moving-averages";
import { calculateATR } from "./atr";

export interface KeltnerChannelsResult {
  readonly upper: number;
  readonly middle: number;
  readonly lower: number;
  readonly width: number;
  readonly position: number;
  readonly signal: "ABOVE" | "WITHIN" | "BELOW";
}

// Signal classification
const classifySignal = Match.type<{ price: number; upper: number; lower: number }>().pipe(
  Match.when(
    ({ price, upper }) => price > upper,
    () => "ABOVE" as const
  ),
  Match.when(
    ({ price, lower }) => price < lower,
    () => "BELOW" as const
  ),
  Match.orElse(() => "WITHIN" as const)
);

// Round helpers
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

// Calculate Keltner Channels
export const calculateKeltnerChannels = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 20,
  multiplier: number = 2
): KeltnerChannelsResult => {
  const ema = calculateEMA(closes, period);
  const middle = ema.value;
  const atr = calculateATR(highs, lows, closes, period);
  const upper = middle + multiplier * atr.value;
  const lower = middle - multiplier * atr.value;
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

// Calculate Keltner series using Arr.makeBy
export const calculateKeltnerChannelsSeries = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 20,
  multiplier: number = 2
): {
  readonly upper: ReadonlyArray<number>;
  readonly middle: ReadonlyArray<number>;
  readonly lower: ReadonlyArray<number>;
} => {
  const results = pipe(
    Arr.makeBy(closes.length - period, (i) => {
      const idx = i + period;
      const windowCloses = Arr.take(closes, idx + 1);
      const windowHighs = Arr.take(highs, idx + 1);
      const windowLows = Arr.take(lows, idx + 1);
      return calculateKeltnerChannels(windowCloses, windowHighs, windowLows, period, multiplier);
    })
  );

  return {
    upper: Arr.map(results, (r) => r.upper),
    middle: Arr.map(results, (r) => r.middle),
    lower: Arr.map(results, (r) => r.lower),
  };
};

// Effect-based wrapper
export const computeKeltnerChannels = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 20,
  multiplier: number = 2
): Effect.Effect<KeltnerChannelsResult> =>
  Effect.sync(() => calculateKeltnerChannels(closes, highs, lows, period, multiplier));

export const KeltnerChannelsMetadata: FormulaMetadata = {
  name: "KeltnerChannels",
  category: "volatility",
  difficulty: "beginner",
  description: "Keltner Channels - volatility-based channels using EMA and ATR",
  requiredInputs: ["closes", "highs", "lows"],
  optionalInputs: ["period", "multiplier"],
  minimumDataPoints: 21,
  outputType: "KeltnerChannelsResult",
  useCases: [
    "trend identification",
    "breakout detection",
    "support/resistance levels",
    "volatility analysis",
  ],
  timeComplexity: "O(n)",
  dependencies: ["EMA", "ATR"],
};
