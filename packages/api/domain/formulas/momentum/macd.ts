/** MACD - Real calculation using historical close prices */

import { Effect, Match } from "effect";

export interface MACDHistoricalResult {
  readonly macd: number;
  readonly signal: number;
  readonly histogram: number;
  readonly trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  readonly crossover: "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE";
}

const DEFAULT_FAST = 12;
const DEFAULT_SLOW = 26;
const DEFAULT_SIGNAL = 9;

const classifyTrend = Match.type<number>().pipe(
  Match.when(
    (h) => h > 0.5,
    () => "BULLISH" as const
  ),
  Match.when(
    (h) => h < -0.5,
    () => "BEARISH" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

const calculateEMA = (data: readonly number[], period: number): number[] => {
  if (data.length < period) return [];

  const k = 2 / (period + 1);
  const result: number[] = [];

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  result.push(sum / period);

  for (let i = period; i < data.length; i++) {
    result.push(data[i] * k + result[result.length - 1] * (1 - k));
  }

  return result;
};

const calculateMACD = (
  closes: readonly number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): MACDHistoricalResult => {
  if (closes.length < slowPeriod + signalPeriod) {
    return {
      macd: 0,
      signal: 0,
      histogram: 0,
      trend: "NEUTRAL",
      crossover: "NONE",
    };
  }

  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const startIdx = slowPeriod - fastPeriod;
  const macdLine: number[] = [];

  for (let i = 0; i < slowEMA.length; i++) {
    const fastIdx = startIdx + i;
    if (fastIdx >= 0 && fastIdx < fastEMA.length) {
      macdLine.push(fastEMA[fastIdx] - slowEMA[i]);
    }
  }

  if (macdLine.length < signalPeriod) {
    return {
      macd: macdLine.length > 0 ? macdLine[macdLine.length - 1] : 0,
      signal: 0,
      histogram: 0,
      trend: "NEUTRAL",
      crossover: "NONE",
    };
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);

  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];
  const histogram = currentMACD - currentSignal;

  let crossover: "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE" = "NONE";
  if (macdLine.length >= 2 && signalLine.length >= 2) {
    const prevMACD = macdLine[macdLine.length - 2];
    const prevSignal = signalLine[signalLine.length - 2];
    if (prevMACD < prevSignal && currentMACD > currentSignal) {
      crossover = "BULLISH_CROSS";
    } else if (prevMACD > prevSignal && currentMACD < currentSignal) {
      crossover = "BEARISH_CROSS";
    }
  }

  return {
    macd: Math.round(currentMACD * 1000) / 1000,
    signal: Math.round(currentSignal * 1000) / 1000,
    histogram: Math.round(histogram * 1000) / 1000,
    trend: classifyTrend(histogram),
    crossover,
  };
};

export const computeMACDFromHistory = (
  closes: readonly number[],
  fastPeriod: number = DEFAULT_FAST,
  slowPeriod: number = DEFAULT_SLOW,
  signalPeriod: number = DEFAULT_SIGNAL
): Effect.Effect<MACDHistoricalResult> =>
  Effect.sync(() => calculateMACD(closes, fastPeriod, slowPeriod, signalPeriod));
