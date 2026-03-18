import type { ChartDataPoint } from "../../types/chart";
import type { IndicatorDataPoint } from "../types";

const emaSeries = (values: number[], period: number): number[] => {
  if (values.length === 0) return [];
  const alpha = 2 / (period + 1);
  const output: number[] = new Array(values.length);
  output[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    output[i] = values[i] * alpha + output[i - 1] * (1 - alpha);
  }
  return output;
};

const stochasticNormalize = (values: number[], period: number): number[] => {
  const output: number[] = new Array(values.length).fill(50);
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - period + 1);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let j = start; j <= i; j++) {
      const v = values[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min;
    output[i] = range === 0 ? (i > 0 ? output[i - 1] : 50) : ((values[i] - min) / range) * 100;
  }
  return output;
};

export const calculateSTC = (
  data: ChartDataPoint[],
  fastPeriod: number,
  slowPeriod: number,
  cyclePeriod: number,
  smoothPeriod: number
): IndicatorDataPoint[] => {
  if (data.length < slowPeriod + cyclePeriod) return [];

  const closes = data.map((bar) => bar.close);
  const fastEma = emaSeries(closes, fastPeriod);
  const slowEma = emaSeries(closes, slowPeriod);
  const macd = closes.map((_, i) => fastEma[i] - slowEma[i]);

  const k1 = stochasticNormalize(macd, cyclePeriod);
  const d1 = emaSeries(k1, smoothPeriod);
  const k2 = stochasticNormalize(d1, cyclePeriod);
  const stc = emaSeries(k2, smoothPeriod);

  const warmup = Math.max(slowPeriod, cyclePeriod * 2 + smoothPeriod * 2);
  const result: IndicatorDataPoint[] = [];
  for (let i = warmup; i < data.length; i++) {
    result.push({ time: data[i].time, value: stc[i] });
  }
  return result;
};

export const calculateKRI = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  let rollingSum = 0;
  for (let i = 0; i < period; i++) {
    rollingSum += data[i].close;
  }

  for (let i = period - 1; i < data.length; i++) {
    if (i > period - 1) {
      rollingSum += data[i].close - data[i - period].close;
    }
    const sma = rollingSum / period;
    const value = sma === 0 ? 0 : ((data[i].close - sma) / sma) * 100;
    result.push({ time: data[i].time, value });
  }

  return result;
};

export const calculateDVO = (
  data: ChartDataPoint[],
  maPeriod: number,
  rankPeriod: number
): IndicatorDataPoint[] => {
  const detrended: { time: number; value: number }[] = [];
  if (data.length < maPeriod + rankPeriod) return [];

  let rollingSum = 0;
  for (let i = 0; i < maPeriod; i++) {
    rollingSum += data[i].close;
  }

  for (let i = maPeriod - 1; i < data.length; i++) {
    if (i > maPeriod - 1) {
      rollingSum += data[i].close - data[i - maPeriod].close;
    }
    const sma = rollingSum / maPeriod;
    detrended.push({
      time: data[i].time,
      value: sma === 0 ? 0 : data[i].close / sma - 1,
    });
  }

  const result: IndicatorDataPoint[] = [];
  for (let i = rankPeriod - 1; i < detrended.length; i++) {
    let lessCount = 0;
    for (let j = i - rankPeriod + 1; j <= i; j++) {
      if (detrended[j].value < detrended[i].value) {
        lessCount += 1;
      }
    }
    const rank = rankPeriod <= 1 ? 50 : (100 * lessCount) / (rankPeriod - 1);
    result.push({ time: detrended[i].time, value: rank });
  }

  return result;
};

export const calculateVZO = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  if (data.length < 2) return [];

  const vp: number[] = [];
  const absVp: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const signedVolume = data[i].close >= data[i - 1].close ? data[i].volume : -data[i].volume;
    vp.push(signedVolume);
    absVp.push(Math.abs(signedVolume));
  }

  const emaVp = emaSeries(vp, period);
  const emaAbsVp = emaSeries(absVp, period);

  const result: IndicatorDataPoint[] = [];
  for (let i = 0; i < emaVp.length; i++) {
    const denominator = emaAbsVp[i];
    const value = denominator === 0 ? 0 : (100 * emaVp[i]) / denominator;
    result.push({ time: data[i + 1].time, value });
  }

  return result;
};

export const calculateVortexSpread = (
  data: ChartDataPoint[],
  period: number
): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length <= period) return result;

  const vmPlus: number[] = [];
  const vmMinus: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < data.length; i++) {
    vmPlus.push(Math.abs(data[i].high - data[i - 1].low));
    vmMinus.push(Math.abs(data[i].low - data[i - 1].high));
    tr.push(
      Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      )
    );
  }

  for (let i = period - 1; i < vmPlus.length; i++) {
    let sumPlus = 0;
    let sumMinus = 0;
    let sumTr = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumPlus += vmPlus[j];
      sumMinus += vmMinus[j];
      sumTr += tr[j];
    }

    const value = sumTr === 0 ? 0 : sumPlus / sumTr - sumMinus / sumTr;
    result.push({ time: data[i + 1].time, value });
  }

  return result;
};
