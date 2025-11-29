/** ATR (Average True Range) - Volatility Measurement with functional patterns */
// TR = max(High - Low, |High - PrevClose|, |Low - PrevClose|), ATR = EMA(TR)

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateEMA } from "../trend/moving-averages";

export interface ATRResult {
  readonly value: number;
  readonly normalizedATR: number;
  readonly volatilityLevel: "VERY_LOW" | "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH";
}

// Volatility level classification
const classifyVolatility = Match.type<number>().pipe(
  Match.when(
    (n) => n < 1,
    () => "VERY_LOW" as const
  ),
  Match.when(
    (n) => n < 2,
    () => "LOW" as const
  ),
  Match.when(
    (n) => n < 4,
    () => "NORMAL" as const
  ),
  Match.when(
    (n) => n < 6,
    () => "HIGH" as const
  ),
  Match.orElse(() => "VERY_HIGH" as const)
);

// Round to 2 decimal places
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Calculate True Range
export const calculateTrueRange = (high: number, low: number, previousClose: number): number =>
  Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));

// Calculate TR series using Arr.zipWith
const calculateTRSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>
): ReadonlyArray<number> =>
  pipe(
    Arr.zipWith(
      Arr.zip(Arr.drop(highs, 1), Arr.drop(lows, 1)),
      Arr.dropRight(closes, 1),
      ([high, low], prevClose) => calculateTrueRange(high, low, prevClose)
    )
  );

// Calculate ATR
export const calculateATR = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 14
): ATRResult => {
  const trSeries = calculateTRSeries(highs, lows, closes);
  const atr = calculateEMA(trSeries, period);
  const currentPrice = closes[closes.length - 1];
  const normalizedATR = (atr.value / currentPrice) * 100;

  return {
    value: round2(atr.value),
    normalizedATR: round2(normalizedATR),
    volatilityLevel: classifyVolatility(normalizedATR),
  };
};

// Calculate ATR series using Arr.scan
export const calculateATRSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 14
): ReadonlyArray<number> => {
  const trSeries = calculateTRSeries(highs, lows, closes);
  const alpha = 2 / (period + 1);
  const initialATR =
    pipe(
      Arr.take(trSeries, period),
      Arr.reduce(0, (a, b) => a + b)
    ) / period;
  const remaining = Arr.drop(trSeries, period);

  return pipe(
    remaining,
    Arr.scan(initialATR, (atr, tr) => tr * alpha + atr * (1 - alpha))
  );
};

// Effect-based wrapper
export const computeATR = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 14
): Effect.Effect<ATRResult> => Effect.sync(() => calculateATR(highs, lows, closes, period));

export const ATRMetadata: FormulaMetadata = {
  name: "ATR",
  category: "volatility",
  difficulty: "beginner",
  description: "Average True Range - measures market volatility",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period"],
  minimumDataPoints: 15,
  outputType: "ATRResult",
  useCases: [
    "volatility measurement",
    "stop-loss placement",
    "position sizing",
    "breakout confirmation",
  ],
  timeComplexity: "O(n)",
  dependencies: ["EMA"],
};
