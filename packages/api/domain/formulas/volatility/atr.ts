/** ATR - Real calculation using historical OHLC data */

import { Effect, Match } from "effect";

export interface ATRHistoricalResult {
  readonly atr: number;
  readonly normalizedATR: number;
  readonly volatility: "HIGH" | "MEDIUM" | "LOW";
}

const DEFAULT_PERIOD = 14;

const classifyVolatility = Match.type<number>().pipe(
  Match.when(
    (n) => n > 5,
    () => "HIGH" as const
  ),
  Match.when(
    (n) => n > 2,
    () => "MEDIUM" as const
  ),
  Match.orElse(() => "LOW" as const)
);

const calculateATR = (
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  period: number
): ATRHistoricalResult => {
  const len = Math.min(highs.length, lows.length, closes.length);

  if (len < period + 1) {
    return { atr: 0, normalizedATR: 0, volatility: "LOW" };
  }

  const trueRanges: number[] = [];

  for (let i = 1; i < len; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  let atr = 0;
  for (let i = 0; i < period; i++) {
    atr += trueRanges[i];
  }
  atr /= period;

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  const currentPrice = closes[closes.length - 1];
  const normalizedATR = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;

  return {
    atr: Math.round(atr * 100) / 100,
    normalizedATR: Math.round(normalizedATR * 100) / 100,
    volatility: classifyVolatility(normalizedATR),
  };
};

export const computeATRFromHistory = (
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  period: number = DEFAULT_PERIOD
): Effect.Effect<ATRHistoricalResult> =>
  Effect.sync(() => calculateATR(highs, lows, closes, period));
