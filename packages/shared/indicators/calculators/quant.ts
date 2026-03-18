import type { ChartDataPoint } from "../../types/chart";
import type { IndicatorDataPoint } from "../types";

const emaNumbers = (values: number[], period: number): number[] => {
  if (values.length === 0) return [];
  const alpha = 2 / (period + 1);
  const out: number[] = new Array(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    out[i] = values[i] * alpha + out[i - 1] * (1 - alpha);
  }
  return out;
};

const smaNumbers = (values: number[], period: number): number[] => {
  if (values.length < period) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out.push(sum / period);
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    out.push(sum / period);
  }
  return out;
};

export const calculatePPO = (
  data: ChartDataPoint[],
  fastPeriod: number,
  slowPeriod: number
): IndicatorDataPoint[] => {
  if (data.length < slowPeriod) return [];
  const closes = data.map((d) => d.close);
  const fast = emaNumbers(closes, fastPeriod);
  const slow = emaNumbers(closes, slowPeriod);
  const result: IndicatorDataPoint[] = [];

  for (let i = slowPeriod - 1; i < closes.length; i++) {
    const base = slow[i];
    const value = base === 0 ? 0 : ((fast[i] - base) / base) * 100;
    result.push({ time: data[i].time, value });
  }
  return result;
};

export const calculateTRIX = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  if (data.length < period * 3 + 1) return [];
  const closes = data.map((d) => d.close);
  const ema1 = emaNumbers(closes, period);
  const ema2 = emaNumbers(ema1, period);
  const ema3 = emaNumbers(ema2, period);

  const result: IndicatorDataPoint[] = [];
  for (let i = 1; i < ema3.length; i++) {
    const prev = ema3[i - 1];
    const value = prev === 0 ? 0 : ((ema3[i] - prev) / prev) * 100;
    result.push({ time: data[i].time, value });
  }
  return result;
};

export const calculateStochRSI = (
  data: ChartDataPoint[],
  rsiPeriod: number,
  stochPeriod: number,
  smoothK: number
): IndicatorDataPoint[] => {
  if (data.length < rsiPeriod + stochPeriod + smoothK) return [];

  const rsiValues: number[] = new Array(data.length).fill(Number.NaN);
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= rsiPeriod; i++) {
    const delta = data[i].close - data[i - 1].close;
    gainSum += delta > 0 ? delta : 0;
    lossSum += delta < 0 ? -delta : 0;
  }

  let avgGain = gainSum / rsiPeriod;
  let avgLoss = lossSum / rsiPeriod;

  for (let i = rsiPeriod; i < data.length; i++) {
    if (i > rsiPeriod) {
      const delta = data[i].close - data[i - 1].close;
      avgGain = (avgGain * (rsiPeriod - 1) + (delta > 0 ? delta : 0)) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + (delta < 0 ? -delta : 0)) / rsiPeriod;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues[i] = 100 - 100 / (1 + rs);
  }

  const rawStoch: number[] = [];
  const rawTimes: number[] = [];

  for (let i = rsiPeriod + stochPeriod - 1; i < data.length; i++) {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const value = rsiValues[j];
      if (Number.isNaN(value)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    const range = max - min;
    const current = rsiValues[i];
    const stoch = range <= 0 ? 50 : ((current - min) / range) * 100;
    rawStoch.push(stoch);
    rawTimes.push(data[i].time);
  }

  const smoothed = smaNumbers(rawStoch, smoothK);
  const result: IndicatorDataPoint[] = [];
  for (let i = 0; i < smoothed.length; i++) {
    result.push({ time: rawTimes[i + smoothK - 1], value: smoothed[i] });
  }
  return result;
};

export const calculateVolumeOscillator = (
  data: ChartDataPoint[],
  shortPeriod: number,
  longPeriod: number
): IndicatorDataPoint[] => {
  if (data.length < longPeriod) return [];
  const volumes = data.map((d) => d.volume);
  const shortEma = emaNumbers(volumes, shortPeriod);
  const longEma = emaNumbers(volumes, longPeriod);

  const result: IndicatorDataPoint[] = [];
  for (let i = longPeriod - 1; i < data.length; i++) {
    const base = longEma[i];
    const value = base === 0 ? 0 : ((shortEma[i] - base) / base) * 100;
    result.push({ time: data[i].time, value });
  }
  return result;
};

export const calculateChaikinOscillator = (
  data: ChartDataPoint[],
  fastPeriod: number,
  slowPeriod: number
): IndicatorDataPoint[] => {
  if (data.length < slowPeriod) return [];
  const adLine: number[] = [];
  let cumulative = 0;

  for (const bar of data) {
    const range = bar.high - bar.low;
    const mfm = range === 0 ? 0 : (bar.close - bar.low - (bar.high - bar.close)) / range;
    cumulative += mfm * bar.volume;
    adLine.push(cumulative);
  }

  const fast = emaNumbers(adLine, fastPeriod);
  const slow = emaNumbers(adLine, slowPeriod);
  const result: IndicatorDataPoint[] = [];

  for (let i = slowPeriod - 1; i < data.length; i++) {
    result.push({ time: data[i].time, value: fast[i] - slow[i] });
  }
  return result;
};

export const calculateEaseOfMovement = (
  data: ChartDataPoint[],
  period: number
): IndicatorDataPoint[] => {
  if (data.length < period + 1) return [];
  const raw: number[] = [];
  const times: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const midpointMove =
      (data[i].high + data[i].low) / 2 - (data[i - 1].high + data[i - 1].low) / 2;
    const boxRatio = data[i].volume === 0 ? 0 : (data[i].high - data[i].low) / data[i].volume;
    raw.push(midpointMove * boxRatio * 1_000_000);
    times.push(data[i].time);
  }

  const smoothed = smaNumbers(raw, period);
  const result: IndicatorDataPoint[] = [];
  for (let i = 0; i < smoothed.length; i++) {
    result.push({ time: times[i + period - 1], value: smoothed[i] });
  }
  return result;
};

export const calculateHistoricalVolatility = (
  data: ChartDataPoint[],
  period: number,
  annualization: number
): IndicatorDataPoint[] => {
  if (data.length < period + 1) return [];
  const logReturns: number[] = [];
  const times: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1].close;
    const curr = data[i].close;
    const ret = prev <= 0 || curr <= 0 ? 0 : Math.log(curr / prev);
    logReturns.push(ret);
    times.push(data[i].time);
  }

  const result: IndicatorDataPoint[] = [];
  for (let i = period - 1; i < logReturns.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += logReturns[j];
    const mean = sum / period;

    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = logReturns[j] - mean;
      variance += diff * diff;
    }
    variance /= period;
    result.push({
      time: times[i],
      value: Math.sqrt(variance) * Math.sqrt(annualization) * 100,
    });
  }
  return result;
};

export const calculateAroonOscillator = (
  data: ChartDataPoint[],
  period: number
): IndicatorDataPoint[] => {
  if (data.length < period) return [];
  const result: IndicatorDataPoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let highestIndex = i - period + 1;
    let lowestIndex = i - period + 1;
    for (let j = i - period + 1; j <= i; j++) {
      if (data[j].high >= data[highestIndex].high) highestIndex = j;
      if (data[j].low <= data[lowestIndex].low) lowestIndex = j;
    }

    const aroonUp = ((period - (i - highestIndex)) / period) * 100;
    const aroonDown = ((period - (i - lowestIndex)) / period) * 100;
    result.push({ time: data[i].time, value: aroonUp - aroonDown });
  }
  return result;
};
