import type { ChartDataPoint } from "../../types/chart";
import type { IndicatorDataPoint } from "../types";

export const calculateRSI = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length <= period) return result;

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  let avgGain = gains.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((acc, val) => acc + val, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: data[i + 1].time, value: 100 - 100 / (1 + rs) });
  }

  return result;
};

export const calculateMACDLine = (
  data: ChartDataPoint[],
  fastPeriod: number,
  slowPeriod: number,
  calculateEMA: (data: ChartDataPoint[], period: number) => IndicatorDataPoint[]
): IndicatorDataPoint[] => {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  const startIndex = slowPeriod - fastPeriod;
  const result: IndicatorDataPoint[] = [];

  for (let i = 0; i < slowEMA.length; i++) {
    const fastPoint = fastEMA[i + startIndex];
    const slowPoint = slowEMA[i];
    if (!fastPoint || !slowPoint) continue;
    result.push({ time: slowPoint.time, value: fastPoint.value - slowPoint.value });
  }

  return result;
};

export const calculateStochasticK = (
  data: ChartDataPoint[],
  period: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  const maxDeque: number[] = [];
  const minDeque: number[] = [];

  for (let i = 0; i < data.length; i++) {
    while (maxDeque.length && data[maxDeque[maxDeque.length - 1]].high <= data[i].high) {
      maxDeque.pop();
    }
    while (minDeque.length && data[minDeque[minDeque.length - 1]].low >= data[i].low) {
      minDeque.pop();
    }

    maxDeque.push(i);
    minDeque.push(i);

    const left = i - period + 1;
    while (maxDeque.length && maxDeque[0] < left) maxDeque.shift();
    while (minDeque.length && minDeque[0] < left) minDeque.shift();

    if (i < period - 1) continue;

    const high = data[maxDeque[0]].high;
    const low = data[minDeque[0]].low;
    const k = high === low ? 50 : ((data[i].close - low) / (high - low)) * 100;
    result.push({ time: data[i].time, value: k });
  }

  return result;
};

export const calculateAwesomeOscillator = (
  data: ChartDataPoint[],
  fast: number,
  slow: number
): IndicatorDataPoint[] => {
  if (fast >= slow) {
    return [];
  }

  const medianData: ChartDataPoint[] = data.map((bar) => {
    const median = (bar.high + bar.low) / 2;
    return {
      ...bar,
      open: median,
      high: median,
      low: median,
      close: median,
    };
  });

  const sma = (arr: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
    const output: IndicatorDataPoint[] = [];
    if (arr.length < period) return output;
    let rolling = 0;
    for (let i = 0; i < period; i++) rolling += arr[i].close;
    output.push({ time: arr[period - 1].time, value: rolling / period });
    for (let i = period; i < arr.length; i++) {
      rolling += arr[i].close - arr[i - period].close;
      output.push({ time: arr[i].time, value: rolling / period });
    }
    return output;
  };

  const fastSeries = sma(medianData, fast);
  const slowSeries = sma(medianData, slow);
  const fastByTime = new Map<number, number>();
  for (const point of fastSeries) {
    fastByTime.set(point.time, point.value);
  }

  const result: IndicatorDataPoint[] = [];
  for (const point of slowSeries) {
    const fastValue = fastByTime.get(point.time);
    if (fastValue === undefined) continue;
    result.push({ time: point.time, value: fastValue - point.value });
  }

  return result;
};

export const calculateUltimateOscillator = (
  data: ChartDataPoint[],
  shortPeriod: number,
  mediumPeriod: number,
  longPeriod: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < longPeriod + 1) return result;

  const bp: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const prevClose = data[i - 1].close;
    const minLow = Math.min(data[i].low, prevClose);
    const maxHigh = Math.max(data[i].high, prevClose);
    bp.push(data[i].close - minLow);
    tr.push(maxHigh - minLow);
  }

  const sumWindow = (values: number[], end: number, length: number): number => {
    let sum = 0;
    for (let i = end - length + 1; i <= end; i++) {
      sum += values[i] ?? 0;
    }
    return sum;
  };

  const start = Math.max(shortPeriod, mediumPeriod, longPeriod) - 1;
  for (let i = start; i < bp.length; i++) {
    const avg7Den = sumWindow(tr, i, shortPeriod);
    const avg14Den = sumWindow(tr, i, mediumPeriod);
    const avg28Den = sumWindow(tr, i, longPeriod);
    if (avg7Den === 0 || avg14Den === 0 || avg28Den === 0) continue;

    const avg7 = sumWindow(bp, i, shortPeriod) / avg7Den;
    const avg14 = sumWindow(bp, i, mediumPeriod) / avg14Den;
    const avg28 = sumWindow(bp, i, longPeriod) / avg28Den;

    const value = 100 * ((4 * avg7 + 2 * avg14 + avg28) / 7);
    result.push({ time: data[i + 1].time, value });
  }

  return result;
};

export const calculateWilliamsR = (
  data: ChartDataPoint[],
  period: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  const maxDeque: number[] = [];
  const minDeque: number[] = [];

  for (let i = 0; i < data.length; i++) {
    while (maxDeque.length && data[maxDeque[maxDeque.length - 1]].high <= data[i].high) {
      maxDeque.pop();
    }
    while (minDeque.length && data[minDeque[minDeque.length - 1]].low >= data[i].low) {
      minDeque.pop();
    }
    maxDeque.push(i);
    minDeque.push(i);

    const left = i - period + 1;
    while (maxDeque.length && maxDeque[0] < left) maxDeque.shift();
    while (minDeque.length && minDeque[0] < left) minDeque.shift();

    if (i < period - 1) continue;
    const high = data[maxDeque[0]].high;
    const low = data[minDeque[0]].low;
    const value = high === low ? -50 : -100 * ((high - data[i].close) / (high - low));
    result.push({ time: data[i].time, value });
  }

  return result;
};

import { mean } from "../math";

export const calculateCCI = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  const typicalPrices: number[] = [];

  for (let i = 0; i < data.length; i++) {
    typicalPrices.push((data[i].high + data[i].low + data[i].close) / 3);
  }

  for (let i = period - 1; i < data.length; i++) {
    const window = typicalPrices.slice(i - period + 1, i + 1);
    const sma = mean(window);
    const deviations = window.map((tp) => Math.abs(tp - sma));
    const meanDeviation = mean(deviations);
    const cci = meanDeviation === 0 ? 0 : (typicalPrices[i] - sma) / (0.015 * meanDeviation);
    result.push({ time: data[i].time, value: cci });
  }
  return result;
};

export const calculateROC = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length <= period) return result;

  for (let i = period; i < data.length; i++) {
    const prevClose = data[i - period].close;
    const roc = prevClose === 0 ? 0 : ((data[i].close - prevClose) / prevClose) * 100;
    result.push({ time: data[i].time, value: roc });
  }
  return result;
};

export const calculateMomentum = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length <= period) return result;

  for (let i = period; i < data.length; i++) {
    result.push({ time: data[i].time, value: data[i].close - data[i - period].close });
  }
  return result;
};

export const calculateTSI = (
  data: ChartDataPoint[],
  longPeriod: number,
  shortPeriod: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < longPeriod + shortPeriod) return result;

  const changes: number[] = [];
  const absChanges: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    changes.push(change);
    absChanges.push(Math.abs(change));
  }

  const doubleEMA = (values: number[], long: number, short: number): number[] => {
    const firstEMA: number[] = [];
    let ema1 = values.slice(0, long).reduce((a, b) => a + b, 0) / long;
    const mult1 = 2 / (long + 1);

    for (let i = long - 1; i < values.length; i++) {
      if (i === long - 1) firstEMA.push(ema1);
      else {
        ema1 = (values[i] - ema1) * mult1 + ema1;
        firstEMA.push(ema1);
      }
    }

    const secondEMA: number[] = [];
    let ema2 = firstEMA.slice(0, short).reduce((a, b) => a + b, 0) / short;
    const mult2 = 2 / (short + 1);

    for (let i = short - 1; i < firstEMA.length; i++) {
      if (i === short - 1) secondEMA.push(ema2);
      else {
        ema2 = (firstEMA[i] - ema2) * mult2 + ema2;
        secondEMA.push(ema2);
      }
    }
    return secondEMA;
  };

  const smoothedChanges = doubleEMA(changes, longPeriod, shortPeriod);
  const smoothedAbsChanges = doubleEMA(absChanges, longPeriod, shortPeriod);
  const startIdx = longPeriod + shortPeriod - 1;

  for (let i = 0; i < smoothedChanges.length; i++) {
    const tsi =
      smoothedAbsChanges[i] === 0 ? 0 : (100 * smoothedChanges[i]) / smoothedAbsChanges[i];
    result.push({ time: data[startIdx + i].time, value: tsi });
  }
  return result;
};
