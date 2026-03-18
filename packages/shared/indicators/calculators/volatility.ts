import type { ChartDataPoint } from "../../types/chart";
import type { IndicatorDataPoint, BandIndicatorDataPoint } from "../types";

import { getTrueRange } from "../math";

export const calculateATR = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length <= period) return result;

  const trSeries: number[] = [];
  for (let i = 1; i < data.length; i++) {
    trSeries.push(getTrueRange(data[i].high, data[i].low, data[i - 1].close));
  }

  const multiplier = 2 / (period + 1);
  let atr = trSeries.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push({ time: data[period].time, value: atr });

  for (let i = period; i < trSeries.length; i++) {
    atr = trSeries[i] * multiplier + atr * (1 - multiplier);
    result.push({ time: data[i + 1].time, value: atr });
  }

  return result;
};

export const calculateBollingerBands = (
  data: ChartDataPoint[],
  period: number,
  stdDev: number
): BandIndicatorDataPoint[] => {
  const result: BandIndicatorDataPoint[] = [];
  if (data.length < period) return result;

  let sum = 0;
  let sumSquares = 0;
  for (let i = 0; i < period; i++) {
    const close = data[i].close;
    sum += close;
    sumSquares += close * close;
  }

  for (let i = period - 1; i < data.length; i++) {
    if (i > period - 1) {
      const incoming = data[i].close;
      const outgoing = data[i - period].close;
      sum += incoming - outgoing;
      sumSquares += incoming * incoming - outgoing * outgoing;
    }

    const middle = sum / period;
    const variance = Math.max(0, sumSquares / period - middle * middle);
    const sigma = Math.sqrt(variance);

    result.push({
      time: data[i].time,
      upper: middle + stdDev * sigma,
      middle,
      lower: middle - stdDev * sigma,
    });
  }

  return result;
};

export const calculateDonchianChannels = (
  data: ChartDataPoint[],
  period: number
): BandIndicatorDataPoint[] => {
  const result: BandIndicatorDataPoint[] = [];
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
    while (maxDeque.length && maxDeque[0] < left) {
      maxDeque.shift();
    }
    while (minDeque.length && minDeque[0] < left) {
      minDeque.shift();
    }

    if (i < period - 1) continue;

    const upper = data[maxDeque[0]].high;
    const lower = data[minDeque[0]].low;
    result.push({ time: data[i].time, upper, middle: (upper + lower) / 2, lower });
  }

  return result;
};
