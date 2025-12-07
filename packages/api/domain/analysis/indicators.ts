/** Indicator Calculator - Computes indicators from historical OHLCV data */

import { Effect, Match } from "effect";
import type { ChartDataPoint, CryptoPrice } from "@0xsignal/shared";
import type {
  IndicatorOutput,
  RSIOutput,
  MACDOutput,
  ADXOutput,
  ATROutput,
  IndicatorSet,
} from "./indicator-types";
import {
  extractOHLC,
  MIN_PERIODS_RSI,
  MIN_PERIODS_MACD,
  MIN_PERIODS_ADX,
  MIN_PERIODS_ATR,
} from "./indicator-types";

const RSI_PERIOD = 14;
const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;
const ADX_PERIOD = 14;
const ATR_PERIOD = 14;

const classifyRSI = Match.type<number>().pipe(
  Match.when(
    (r) => r > 70,
    () => "OVERBOUGHT" as const
  ),
  Match.when(
    (r) => r < 30,
    () => "OVERSOLD" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

const classifyADX = Match.type<number>().pipe(
  Match.when(
    (a) => a > 50,
    () => "STRONG" as const
  ),
  Match.when(
    (a) => a > 25,
    () => "MODERATE" as const
  ),
  Match.when(
    (a) => a > 15,
    () => "WEAK" as const
  ),
  Match.orElse(() => "NONE" as const)
);

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

const calculateRSI = (closes: readonly number[]): RSIOutput => {
  if (closes.length < MIN_PERIODS_RSI) {
    return { value: 50, signal: "NEUTRAL", avgGain: 0, avgLoss: 0 };
  }

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 0; i < RSI_PERIOD; i++) {
    if (changes[i] > 0) gainSum += changes[i];
    else lossSum += Math.abs(changes[i]);
  }

  let avgGain = gainSum / RSI_PERIOD;
  let avgLoss = lossSum / RSI_PERIOD;

  for (let i = RSI_PERIOD; i < changes.length; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain = (avgGain * (RSI_PERIOD - 1) + change) / RSI_PERIOD;
      avgLoss = (avgLoss * (RSI_PERIOD - 1)) / RSI_PERIOD;
    } else {
      avgGain = (avgGain * (RSI_PERIOD - 1)) / RSI_PERIOD;
      avgLoss = (avgLoss * (RSI_PERIOD - 1) + Math.abs(change)) / RSI_PERIOD;
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  const value = Math.round(Math.max(0, Math.min(100, rsi)) * 10) / 10;

  return { value, signal: classifyRSI(value), avgGain, avgLoss };
};

const calculateEMA = (data: readonly number[], period: number): number[] => {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result.push(sum / period);
  for (let i = period; i < data.length; i++) {
    result.push(data[i] * k + result[result.length - 1] * (1 - k));
  }
  return result;
};

const calculateMACD = (closes: readonly number[]): MACDOutput => {
  if (closes.length < MIN_PERIODS_MACD) {
    return { macd: 0, signal: 0, histogram: 0, crossover: "NONE" };
  }

  const fastEMA = calculateEMA(closes, MACD_FAST);
  const slowEMA = calculateEMA(closes, MACD_SLOW);
  const startIdx = MACD_SLOW - MACD_FAST;
  const macdLine: number[] = [];

  for (let i = 0; i < slowEMA.length; i++) {
    const fastIdx = startIdx + i;
    if (fastIdx >= 0 && fastIdx < fastEMA.length) {
      macdLine.push(fastEMA[fastIdx] - slowEMA[i]);
    }
  }

  if (macdLine.length < MACD_SIGNAL) {
    return { macd: macdLine[macdLine.length - 1] || 0, signal: 0, histogram: 0, crossover: "NONE" };
  }

  const signalLine = calculateEMA(macdLine, MACD_SIGNAL);
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
    crossover,
  };
};

const calculateADX = (
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[]
): ADXOutput => {
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < MIN_PERIODS_ADX) {
    return { value: 25, plusDI: 25, minusDI: 25, trend: "WEAK" };
  }

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < len; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];
    tr.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
  }

  const smooth = (data: number[], p: number): number[] => {
    if (data.length < p) return [];
    const result: number[] = [];
    let sum = 0;
    for (let i = 0; i < p; i++) sum += data[i];
    result.push(sum);
    for (let i = p; i < data.length; i++) {
      result.push(result[result.length - 1] - result[result.length - 1] / p + data[i]);
    }
    return result;
  };

  const smoothedTR = smooth(tr, ADX_PERIOD);
  const smoothedPlusDM = smooth(plusDM, ADX_PERIOD);
  const smoothedMinusDM = smooth(minusDM, ADX_PERIOD);

  if (smoothedTR.length === 0) {
    return { value: 25, plusDI: 25, minusDI: 25, trend: "WEAK" };
  }

  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < smoothedTR.length; i++) {
    const pdi = smoothedTR[i] > 0 ? (smoothedPlusDM[i] / smoothedTR[i]) * 100 : 0;
    const mdi = smoothedTR[i] > 0 ? (smoothedMinusDM[i] / smoothedTR[i]) * 100 : 0;
    plusDI.push(pdi);
    minusDI.push(mdi);
    const diSum = pdi + mdi;
    dx.push(diSum > 0 ? (Math.abs(pdi - mdi) / diSum) * 100 : 0);
  }

  const smoothedDX = smooth(dx, ADX_PERIOD);
  const currentPlusDI = plusDI[plusDI.length - 1];
  const currentMinusDI = minusDI[minusDI.length - 1];
  const currentADX = smoothedDX.length > 0 ? smoothedDX[smoothedDX.length - 1] / ADX_PERIOD : 25;
  const value = Math.round(Math.min(100, Math.max(0, currentADX)) * 10) / 10;

  return {
    value,
    plusDI: Math.round(currentPlusDI * 10) / 10,
    minusDI: Math.round(currentMinusDI * 10) / 10,
    trend: classifyADX(value),
  };
};

const calculateATR = (
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[]
): ATROutput => {
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < MIN_PERIODS_ATR) {
    return { value: 0, normalized: 0, volatility: "LOW" };
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < len; i++) {
    trueRanges.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }

  let atr = 0;
  for (let i = 0; i < ATR_PERIOD; i++) atr += trueRanges[i];
  atr /= ATR_PERIOD;

  for (let i = ATR_PERIOD; i < trueRanges.length; i++) {
    atr = (atr * (ATR_PERIOD - 1) + trueRanges[i]) / ATR_PERIOD;
  }

  const currentPrice = closes[closes.length - 1];
  const normalized = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;

  return {
    value: Math.round(atr * 100) / 100,
    normalized: Math.round(normalized * 100) / 100,
    volatility: classifyVolatility(normalized),
  };
};

export const computeIndicators = (
  ohlcv: readonly ChartDataPoint[]
): Effect.Effect<IndicatorOutput> =>
  Effect.sync(() => {
    const { highs, lows, closes } = extractOHLC(ohlcv);
    const dataPoints = ohlcv.length;
    const isValid = dataPoints >= MIN_PERIODS_MACD;

    return {
      rsi: calculateRSI(closes),
      macd: calculateMACD(closes),
      adx: calculateADX(highs, lows, closes),
      atr: calculateATR(highs, lows, closes),
      isValid,
      dataPoints,
    };
  });
