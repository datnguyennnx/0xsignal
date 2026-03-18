import type { ChartDataPoint } from "../../types/chart";

export const getTrueRange = (high: number, low: number, prevClose: number): number => {
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
};

export const calculateATR = (data: ChartDataPoint[], period: number): number => {
  if (data.length < period + 1) return 0;
  let atrSum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const tr = getTrueRange(data[i].high, data[i].low, data[i - 1]?.close ?? data[i].open);
    atrSum += tr;
  }
  return atrSum / period;
};

export const isSwingHigh = (data: ChartDataPoint[], index: number, lookback: number): boolean => {
  if (index < lookback || index >= data.length - lookback) return false;
  const high = data[index].high;
  for (let i = index - lookback; i <= index + lookback; i++) {
    if (i !== index && data[i].high >= high) return false;
  }
  return true;
};

export const isSwingLow = (data: ChartDataPoint[], index: number, lookback: number): boolean => {
  if (index < lookback || index >= data.length - lookback) return false;
  const low = data[index].low;
  for (let i = index - lookback; i <= index + lookback; i++) {
    if (i !== index && data[i].low <= low) return false;
  }
  return true;
};

export const getSpread = (bar: ChartDataPoint): number => bar.high - bar.low;

export const isDownBar = (bar: ChartDataPoint): boolean => bar.close < bar.open;

export const isUpBar = (bar: ChartDataPoint): boolean => bar.close > bar.open;

export const average = (arr: number[]): number =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

export const calculateAverageVolume = (
  data: ChartDataPoint[],
  lookback: number,
  endIndex: number
): number => {
  if (endIndex < lookback) return 0;
  let sum = 0;
  for (let i = endIndex - lookback; i < endIndex; i++) {
    sum += data[i].volume;
  }
  return sum / lookback;
};

export const calculateAverageSpread = (
  data: ChartDataPoint[],
  lookback: number,
  endIndex: number
): number => {
  if (endIndex < lookback) return 0;
  let sum = 0;
  for (let i = endIndex - lookback; i < endIndex; i++) {
    sum += getSpread(data[i]);
  }
  return sum / lookback;
};

export const getCandleBodySize = (bar: ChartDataPoint): number => {
  return Math.abs(bar.close - bar.open);
};

export const isBullishCandle = (bar: ChartDataPoint): boolean => {
  return bar.close > bar.open;
};

export const isBearishCandle = (bar: ChartDataPoint): boolean => {
  return bar.close < bar.open;
};
