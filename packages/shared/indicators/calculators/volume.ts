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
  if (data.length <= period) return result;

  const typicalPrices: number[] = [];
  const rawMoneyFlow: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3;
    typicalPrices.push(tp);
    rawMoneyFlow.push(tp * data[i].volume);
  }

  let positiveFlow = 0;
  let negativeFlow = 0;

  for (let j = 1; j <= period; j++) {
    if (typicalPrices[j] > typicalPrices[j - 1]) positiveFlow += rawMoneyFlow[j];
    else if (typicalPrices[j] < typicalPrices[j - 1]) negativeFlow += rawMoneyFlow[j];
  }

  let ratio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
  result.push({ time: data[period].time, value: 100 - 100 / (1 + ratio) });

  for (let i = period + 1; i < data.length; i++) {
    const outgoingIdx = i - period;
    if (typicalPrices[outgoingIdx] > typicalPrices[outgoingIdx - 1]) {
      positiveFlow -= rawMoneyFlow[outgoingIdx];
    } else if (typicalPrices[outgoingIdx] < typicalPrices[outgoingIdx - 1]) {
      negativeFlow -= rawMoneyFlow[outgoingIdx];
    }

    if (typicalPrices[i] > typicalPrices[i - 1]) positiveFlow += rawMoneyFlow[i];
    else if (typicalPrices[i] < typicalPrices[i - 1]) negativeFlow += rawMoneyFlow[i];

    ratio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
    result.push({ time: data[i].time, value: 100 - 100 / (1 + ratio) });
  }
  return result;
};

export const calculateCMF = (data: ChartDataPoint[], period: number): IndicatorDataPoint[] => {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  let sumMFV = 0;
  let sumVolume = 0;
  for (let i = 0; i < period; i++) {
    const range = data[i].high - data[i].low;
    const mfMultiplier =
      range === 0 ? 0 : (data[i].close - data[i].low - (data[i].high - data[i].close)) / range;
    sumMFV += mfMultiplier * data[i].volume;
    sumVolume += data[i].volume;
  }
  result.push({ time: data[period - 1].time, value: sumVolume === 0 ? 0 : sumMFV / sumVolume });

  for (let i = period; i < data.length; i++) {
    const rangeIn = data[i].high - data[i].low;
    const mfIn =
      rangeIn === 0 ? 0 : (data[i].close - data[i].low - (data[i].high - data[i].close)) / rangeIn;
    const rangeOut = data[i - period].high - data[i - period].low;
    const mfOut =
      rangeOut === 0
        ? 0
        : (data[i - period].close -
            data[i - period].low -
            (data[i - period].high - data[i - period].close)) /
          rangeOut;
    sumMFV += mfIn * data[i].volume - mfOut * data[i - period].volume;
    sumVolume += data[i].volume - data[i - period].volume;
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
