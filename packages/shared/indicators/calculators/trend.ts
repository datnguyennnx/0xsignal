import type { ChartDataPoint } from "../../types/chart";
import type { IndicatorDataPoint } from "../types";
import { calculateATR } from "./volatility";
import { getTrueRange } from "../math";

export const calculateVWMA = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    let sumPriceVolume = 0;
    let sumVolume = 0;

    for (const bar of slice) {
      sumPriceVolume += bar.close * bar.volume;
      sumVolume += bar.volume;
    }
    result.push({
      time: data[i].time,
      value: sumVolume === 0 ? data[i].close : sumPriceVolume / sumVolume,
    });
  }
  return result;
};

export const calculateADX = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period * 2) return result;

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const highDiff = data[i].high - data[i - 1].high;
    const lowDiff = data[i - 1].low - data[i].low;
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    tr.push(getTrueRange(data[i].high, data[i].low, data[i - 1].close));
  }

  let smoothPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
  const dx: number[] = [];

  for (let i = period; i < plusDM.length; i++) {
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];
    smoothTR = smoothTR - smoothTR / period + tr[i];

    const plusDI = smoothTR === 0 ? 0 : (100 * smoothPlusDM) / smoothTR;
    const minusDI = smoothTR === 0 ? 0 : (100 * smoothMinusDM) / smoothTR;
    const diSum = plusDI + minusDI;
    dx.push(diSum === 0 ? 0 : (100 * Math.abs(plusDI - minusDI)) / diSum);
  }

  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) {
    adx = (adx * (period - 1) + dx[i]) / period;
    result.push({ time: data[i + period + 1].time, value: adx });
  }
  return result;
};

export const calculateSMA = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  let rollingSum = 0;
  for (let i = 0; i < period; i++) {
    rollingSum += data[i].close;
  }
  result.push({ time: data[period - 1].time, value: rollingSum / period });

  for (let i = period; i < data.length; i++) {
    rollingSum += data[i].close - data[i - period].close;
    result.push({ time: data[i].time, value: rollingSum / period });
  }

  return result;
};

export const calculateWMA = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  const weightSum = (period * (period + 1)) / 2;

  for (let i = period - 1; i < data.length; i++) {
    let weighted = 0;
    for (let w = 1; w <= period; w++) {
      weighted += data[i - period + w].close * w;
    }
    result.push({ time: data[i].time, value: weighted / weightSum });
  }

  return result;
};

export const calculateHMA = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  if (period < 2) return [];

  const halfPeriod = Math.max(1, Math.floor(period / 2));
  const sqrtPeriod = Math.max(1, Math.floor(Math.sqrt(period)));

  const wmaHalf = calculateWMA(data, halfPeriod);
  const wmaFull = calculateWMA(data, period);
  if (!wmaHalf.length || !wmaFull.length) return [];

  const fullByTime = new Map<number, number>();
  for (const point of wmaFull) {
    fullByTime.set(point.time, point.value);
  }

  const diffSeries: ChartDataPoint[] = [];
  for (const point of wmaHalf) {
    const full = fullByTime.get(point.time);
    if (full === undefined) continue;
    diffSeries.push({
      time: point.time,
      open: point.value,
      high: point.value,
      low: point.value,
      close: 2 * point.value - full,
      volume: 0,
    });
  }

  return calculateWMA(diffSeries, sqrtPeriod);
};

export const calculateEMA = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((acc, d) => acc + d.close, 0) / period;
  result.push({ time: data[period - 1].time, value: ema });

  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({ time: data[i].time, value: ema });
  }

  return result;
};

export const calculateParabolicSAR = (
  data: ChartDataPoint[],
  step: number,
  maxStep: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < 2) return result;

  let isUptrend = data[1].close > data[0].close;
  let af = step;
  let ep = isUptrend ? data[0].high : data[0].low;
  let sar = isUptrend ? data[0].low : data[0].high;
  result.push({ time: data[0].time, value: sar });

  for (let i = 1; i < data.length; i++) {
    const prevSar = sar;
    sar = prevSar + af * (ep - prevSar);

    if (isUptrend) {
      sar = Math.min(sar, data[i - 1].low, i > 1 ? data[i - 2].low : data[i - 1].low);
    } else {
      sar = Math.max(sar, data[i - 1].high, i > 1 ? data[i - 2].high : data[i - 1].high);
    }

    const reversed = (isUptrend && data[i].low < sar) || (!isUptrend && data[i].high > sar);

    if (reversed) {
      isUptrend = !isUptrend;
      sar = ep;
      ep = isUptrend ? data[i].high : data[i].low;
      af = step;
    } else if (isUptrend && data[i].high > ep) {
      ep = data[i].high;
      af = Math.min(af + step, maxStep);
    } else if (!isUptrend && data[i].low < ep) {
      ep = data[i].low;
      af = Math.min(af + step, maxStep);
    }

    result.push({ time: data[i].time, value: sar });
  }

  return result;
};

export const calculateSuperTrend = (
  data: ChartDataPoint[],
  period: number,
  multiplier: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  const atrData = calculateATR(data, period);
  if (atrData.length === 0) return result;

  const startIdx = data.length - atrData.length;
  let isUptrend = true;
  let upperBand = 0;
  let lowerBand = 0;
  let superTrend = 0;

  for (let i = 0; i < atrData.length; i++) {
    const dataIdx = startIdx + i;
    const hl2 = (data[dataIdx].high + data[dataIdx].low) / 2;
    const atr = atrData[i].value;

    const basicUpperBand = hl2 + multiplier * atr;
    const basicLowerBand = hl2 - multiplier * atr;

    upperBand =
      basicUpperBand < upperBand || data[dataIdx - 1]?.close > upperBand
        ? basicUpperBand
        : upperBand;
    lowerBand =
      basicLowerBand > lowerBand || data[dataIdx - 1]?.close < lowerBand
        ? basicLowerBand
        : lowerBand;

    if (i === 0) {
      superTrend = data[dataIdx].close > hl2 ? lowerBand : upperBand;
      isUptrend = data[dataIdx].close > hl2;
    } else if (isUptrend) {
      superTrend = lowerBand;
      if (data[dataIdx].close < lowerBand) {
        isUptrend = false;
        superTrend = upperBand;
      }
    } else {
      superTrend = upperBand;
      if (data[dataIdx].close > upperBand) {
        isUptrend = true;
        superTrend = lowerBand;
      }
    }

    result.push({ time: data[dataIdx].time, value: superTrend });
  }

  return result;
};
