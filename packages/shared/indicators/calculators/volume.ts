import type { ChartDataPoint } from "../../types/chart";
import type { IndicatorDataPoint } from "../types";

export const calculateVWAP = (data: ChartDataPoint[]): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    cumulativeTPV += typicalPrice * data[i].volume;
    cumulativeVolume += data[i].volume;
    result.push({ time: data[i].time, value: cumulativeTPV / cumulativeVolume });
  }
  return result;
};

export const calculateOBV = (data: ChartDataPoint[]): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length === 0) return result;

  let obv = 0;
  result.push({ time: data[0].time, value: 0 });

  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) obv += data[i].volume;
    else if (data[i].close < data[i - 1].close) obv -= data[i].volume;
    result.push({ time: data[i].time, value: obv });
  }

  return result;
};

export const calculatePVT = (data: ChartDataPoint[]): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length === 0) return result;

  let pvt = 0;
  result.push({ time: data[0].time, value: pvt });

  for (let i = 1; i < data.length; i++) {
    const prevClose = data[i - 1].close;
    const priceChange = prevClose === 0 ? 0 : (data[i].close - prevClose) / prevClose;
    pvt += data[i].volume * priceChange;
    result.push({ time: data[i].time, value: pvt });
  }

  return result;
};

export const calculateNVI = (data: ChartDataPoint[]): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length === 0) return result;

  let nvi = 1000;
  result.push({ time: data[0].time, value: nvi });

  for (let i = 1; i < data.length; i++) {
    if (data[i].volume < data[i - 1].volume) {
      const prevClose = data[i - 1].close;
      const ratio = prevClose === 0 ? 0 : (data[i].close - prevClose) / prevClose;
      nvi += nvi * ratio;
    }
    result.push({ time: data[i].time, value: nvi });
  }

  return result;
};

export const calculateMFI = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  const typicalPrices: number[] = [];
  const rawMoneyFlow: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3;
    typicalPrices.push(tp);
    rawMoneyFlow.push(tp * data[i].volume);
  }

  for (let i = period; i < data.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) positiveFlow += rawMoneyFlow[j];
      else if (typicalPrices[j] < typicalPrices[j - 1]) negativeFlow += rawMoneyFlow[j];
    }

    const ratio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
    result.push({ time: data[i].time, value: 100 - 100 / (1 + ratio) });
  }
  return result;
};

export const calculateCMF = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    let sumMFV = 0;
    let sumVolume = 0;

    for (const bar of slice) {
      const range = bar.high - bar.low;
      const mfMultiplier = range === 0 ? 0 : (bar.close - bar.low - (bar.high - bar.close)) / range;
      sumMFV += mfMultiplier * bar.volume;
      sumVolume += bar.volume;
    }
    result.push({ time: data[i].time, value: sumVolume === 0 ? 0 : sumMFV / sumVolume });
  }
  return result;
};

export const calculateADLine = (data: ChartDataPoint[]): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  let adLine = 0;

  for (let i = 0; i < data.length; i++) {
    const range = data[i].high - data[i].low;
    const mfMultiplier =
      range === 0 ? 0 : (data[i].close - data[i].low - (data[i].high - data[i].close)) / range;
    adLine += mfMultiplier * data[i].volume;
    result.push({ time: data[i].time, value: adLine });
  }
  return result;
};
