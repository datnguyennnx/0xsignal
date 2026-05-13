import type { ChartDataPoint } from "../../types/chart";
import type { IndicatorDataPoint } from "../types";
import { calculateATR } from "./volatility";

export const calculateATRP = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const atr = calculateATR(data, period);
  const byTime = new Map<number, number>();
  for (const point of data) {
    byTime.set(point.time, point.close);
  }

  const result: IndicatorDataPoint[] = [];
  for (const point of atr) {
    const close = byTime.get(point.time);
    if (close === undefined || close === 0) continue;
    result.push({ time: point.time, value: (100 * point.value) / close });
  }
  return result;
};

export const calculateChoppiness = (
  data: ChartDataPoint[],
  period: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length <= period) return result;

  const tr: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const prevClose = data[i - 1].close;
    tr.push(
      Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - prevClose),
        Math.abs(data[i].low - prevClose)
      )
    );
  }

  let trSum = 0;
  const maxDeque: number[] = [];
  const minDeque: number[] = [];

  for (let i = 1; i < data.length; i++) {
    trSum += tr[i - 1];
    if (i > period) trSum -= tr[i - period - 1];

    while (maxDeque.length && data[maxDeque[maxDeque.length - 1]].high <= data[i].high)
      maxDeque.pop();
    while (minDeque.length && data[minDeque[minDeque.length - 1]].low >= data[i].low)
      minDeque.pop();
    maxDeque.push(i);
    minDeque.push(i);

    const left = i - period + 1;
    while (maxDeque.length && maxDeque[0] < left) maxDeque.shift();
    while (minDeque.length && minDeque[0] < left) minDeque.shift();

    if (i < period) continue;
    const hh = data[maxDeque[0]].high;
    const ll = data[minDeque[0]].low;
    const range = hh - ll;
    const value =
      range <= 0 || trSum <= 0 ? 50 : (100 * Math.log10(trSum / range)) / Math.log10(period);
    result.push({ time: data[i].time, value });
  }

  return result;
};

export const calculateEfficiencyRatio = (
  data: ChartDataPoint[],
  period: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length <= period) return result;

  const absChanges: number[] = [];
  for (let i = 1; i < data.length; i++) {
    absChanges.push(Math.abs(data[i].close - data[i - 1].close));
  }

  let rollingTotal = 0;
  for (let i = 0; i < period; i++) rollingTotal += absChanges[i];

  for (let i = period; i < data.length; i++) {
    const net = Math.abs(data[i].close - data[i - period].close);
    result.push({ time: data[i].time, value: rollingTotal === 0 ? 0 : net / rollingTotal });
    if (i < data.length - 1) {
      rollingTotal += absChanges[i] - absChanges[i - period];
    }
  }

  return result;
};
