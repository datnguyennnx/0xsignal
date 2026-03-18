import type { ChartDataPoint } from "../../types/chart";
import type { IndicatorDataPoint } from "../types";

export const calculateStandardDeviation = (
  data: ChartDataPoint[],
  period: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
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

    const mean = sum / period;
    const variance = Math.max(0, sumSquares / period - mean * mean);
    result.push({ time: data[i].time, value: Math.sqrt(variance) });
  }

  return result;
};

export const calculateZScore = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
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

    const mean = sum / period;
    const variance = Math.max(0, sumSquares / period - mean * mean);
    const stdev = Math.sqrt(variance);
    const value = stdev === 0 ? 0 : (data[i].close - mean) / stdev;
    result.push({ time: data[i].time, value });
  }

  return result;
};

export const calculateRegressionSlope = (
  data: ChartDataPoint[],
  period: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  const n = period;
  const sumX = ((n - 1) * n) / 2;
  const sumXX = ((n - 1) * n * (2 * n - 1)) / 6;
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return result;

  for (let i = period - 1; i < data.length; i++) {
    let sumY = 0;
    let sumXY = 0;
    for (let j = 0; j < period; j++) {
      const y = data[i - period + 1 + j].close;
      sumY += y;
      sumXY += j * y;
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    result.push({ time: data[i].time, value: slope });
  }

  return result;
};
