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

  for (let i = period; i < data.length; i++) {
    let trSum = 0;
    let hh = Number.NEGATIVE_INFINITY;
    let ll = Number.POSITIVE_INFINITY;

    for (let j = i - period + 1; j <= i; j++) {
      trSum += tr[j - 1] ?? 0;
      hh = Math.max(hh, data[j].high);
      ll = Math.min(ll, data[j].low);
    }

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

  for (let i = period; i < data.length; i++) {
    const net = Math.abs(data[i].close - data[i - period].close);
    let total = 0;
    for (let j = i - period + 1; j <= i; j++) {
      total += Math.abs(data[j].close - data[j - 1].close);
    }
    result.push({ time: data[i].time, value: total === 0 ? 0 : net / total });
  }

  return result;
};
