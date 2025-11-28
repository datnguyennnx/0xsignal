/**
 * Indicator calculations - shared between frontend and backend
 * Pure functions using shared math utilities
 */

import type { ChartDataPoint } from "../types/chart";
import { mean } from "../utils/math";
import type {
  IndicatorDataPoint,
  BandIndicatorDataPoint,
  MACDResult,
  StochasticResult,
} from "./types";

const calculateTrueRange = (high: number, low: number, previousClose: number): number => {
  const range1 = high - low;
  const range2 = Math.abs(high - previousClose);
  const range3 = Math.abs(low - previousClose);
  return Math.max(range1, range2, range3);
};

// ============================================================================
// TREND INDICATORS
// ============================================================================

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: ChartDataPoint[], period: number): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: ChartDataPoint[], period: number): IndicatorDataPoint[] {
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
}

// ============================================================================
// VOLATILITY INDICATORS
// ============================================================================

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  data: ChartDataPoint[],
  period: number = 20,
  stdDev: number = 2
): BandIndicatorDataPoint[] {
  const result: BandIndicatorDataPoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const closes = slice.map((d) => d.close);
    const sma = closes.reduce((acc, val) => acc + val, 0) / period;
    const variance = closes.reduce((acc, val) => acc + Math.pow(val - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    result.push({
      time: data[i].time,
      upper: sma + stdDev * std,
      middle: sma,
      lower: sma - stdDev * std,
    });
  }
  return result;
}

/**
 * Calculate ATR (Average True Range)
 */
export function calculateATR(data: ChartDataPoint[], period: number = 14): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];
  const trSeries: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const tr = calculateTrueRange(data[i].high, data[i].low, data[i - 1].close);
    trSeries.push(tr);
  }

  const multiplier = 2 / (period + 1);
  let atr = trSeries.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push({ time: data[period].time, value: atr });

  for (let i = period; i < trSeries.length; i++) {
    atr = trSeries[i] * multiplier + atr * (1 - multiplier);
    result.push({ time: data[i + 1].time, value: atr });
  }
  return result;
}

/**
 * Calculate Keltner Channels
 */
export function calculateKeltnerChannels(
  data: ChartDataPoint[],
  period: number = 20,
  multiplier: number = 2
): BandIndicatorDataPoint[] {
  const result: BandIndicatorDataPoint[] = [];
  const emaData = calculateEMA(data, period);
  const atrData = calculateATR(data, period);
  const startIndex = data.length - atrData.length;

  for (let i = 0; i < atrData.length; i++) {
    const emaIndex = startIndex + i;
    if (emaIndex < emaData.length) {
      const middle = emaData[emaIndex].value;
      const atr = atrData[i].value;
      result.push({
        time: atrData[i].time,
        upper: middle + multiplier * atr,
        middle: middle,
        lower: middle - multiplier * atr,
      });
    }
  }
  return result;
}

/**
 * Calculate Donchian Channels
 */
export function calculateDonchianChannels(
  data: ChartDataPoint[],
  period: number = 20
): BandIndicatorDataPoint[] {
  const result: BandIndicatorDataPoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const upper = Math.max(...slice.map((d) => d.high));
    const lower = Math.min(...slice.map((d) => d.low));
    result.push({ time: data[i].time, upper, middle: (upper + lower) / 2, lower });
  }
  return result;
}

// ============================================================================
// MOMENTUM INDICATORS
// ============================================================================

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(data: ChartDataPoint[], period: number = 14): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  let avgGain = gains.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((acc, val) => acc + val, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: data[i + 1].time, value: 100 - 100 / (1 + rs) });
  }
  return result;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  data: ChartDataPoint[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  const macdLine: IndicatorDataPoint[] = [];
  const startIndex = slowPeriod - fastPeriod;

  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push({
      time: slowEMA[i].time,
      value: fastEMA[i + startIndex].value - slowEMA[i].value,
    });
  }

  const signalLine: IndicatorDataPoint[] = [];
  const multiplier = 2 / (signalPeriod + 1);
  let ema = macdLine.slice(0, signalPeriod).reduce((acc, d) => acc + d.value, 0) / signalPeriod;
  signalLine.push({ time: macdLine[signalPeriod - 1].time, value: ema });

  for (let i = signalPeriod; i < macdLine.length; i++) {
    ema = (macdLine[i].value - ema) * multiplier + ema;
    signalLine.push({ time: macdLine[i].time, value: ema });
  }

  const histogram: IndicatorDataPoint[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push({
      time: signalLine[i].time,
      value: macdLine[i + signalPeriod - 1].value - signalLine[i].value,
    });
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Calculate Stochastic Oscillator
 */
export function calculateStochastic(
  data: ChartDataPoint[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticResult {
  const kSeries: IndicatorDataPoint[] = [];

  for (let i = kPeriod - 1; i < data.length; i++) {
    const slice = data.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map((d) => d.high));
    const low = Math.min(...slice.map((d) => d.low));
    const k = high === low ? 50 : ((data[i].close - low) / (high - low)) * 100;
    kSeries.push({ time: data[i].time, value: k });
  }

  const dSeries: IndicatorDataPoint[] = [];
  for (let i = dPeriod - 1; i < kSeries.length; i++) {
    const window = kSeries.slice(i - dPeriod + 1, i + 1);
    const d = window.reduce((acc, val) => acc + val.value, 0) / dPeriod;
    dSeries.push({ time: kSeries[i].time, value: d });
  }

  return { k: kSeries, d: dSeries };
}

/**
 * Calculate Williams %R
 */
export function calculateWilliamsR(
  data: ChartDataPoint[],
  period: number = 14
): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map((d) => d.high));
    const low = Math.min(...slice.map((d) => d.low));
    const value = high === low ? -50 : -100 * ((high - data[i].close) / (high - low));
    result.push({ time: data[i].time, value });
  }
  return result;
}

// ============================================================================
// VOLUME INDICATORS
// ============================================================================

/**
 * Calculate VWAP (Volume Weighted Average Price)
 */
export function calculateVWAP(data: ChartDataPoint[]): IndicatorDataPoint[] {
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
}

/**
 * Calculate OBV (On-Balance Volume)
 */
export function calculateOBV(data: ChartDataPoint[]): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];
  let obv = 0;
  result.push({ time: data[0].time, value: 0 });

  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) obv += data[i].volume;
    else if (data[i].close < data[i - 1].close) obv -= data[i].volume;
    result.push({ time: data[i].time, value: obv });
  }
  return result;
}

/**
 * Calculate MFI (Money Flow Index)
 */
export function calculateMFI(data: ChartDataPoint[], period: number = 14): IndicatorDataPoint[] {
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
}

// ============================================================================
// OSCILLATOR INDICATORS
// ============================================================================

/**
 * Calculate CCI (Commodity Channel Index)
 */
export function calculateCCI(data: ChartDataPoint[], period: number = 20): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];
  const typicalPrices: number[] = [];

  for (let i = 0; i < data.length; i++) {
    typicalPrices.push((data[i].high + data[i].low + data[i].close) / 3);
  }

  for (let i = period - 1; i < data.length; i++) {
    const window = typicalPrices.slice(i - period + 1, i + 1);
    const sma = mean(window);
    const deviations = window.map((tp) => Math.abs(tp - sma));
    const meanDeviation = mean(deviations);
    const cci = meanDeviation === 0 ? 0 : (typicalPrices[i] - sma) / (0.015 * meanDeviation);
    result.push({ time: data[i].time, value: cci });
  }
  return result;
}

// ============================================================================
// ADVANCED TREND INDICATORS
// ============================================================================

/**
 * Calculate ADX (Average Directional Index)
 */
export function calculateADX(data: ChartDataPoint[], period: number = 14): IndicatorDataPoint[] {
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
    tr.push(calculateTrueRange(data[i].high, data[i].low, data[i - 1].close));
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
}

/**
 * Calculate Parabolic SAR
 */
export function calculateParabolicSAR(
  data: ChartDataPoint[],
  step: number = 0.02,
  maxStep: number = 0.2
): IndicatorDataPoint[] {
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
    } else {
      if (isUptrend && data[i].high > ep) {
        ep = data[i].high;
        af = Math.min(af + step, maxStep);
      } else if (!isUptrend && data[i].low < ep) {
        ep = data[i].low;
        af = Math.min(af + step, maxStep);
      }
    }
    result.push({ time: data[i].time, value: sar });
  }
  return result;
}

/**
 * Calculate SuperTrend
 */
export function calculateSuperTrend(
  data: ChartDataPoint[],
  period: number = 10,
  multiplier: number = 3
): IndicatorDataPoint[] {
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
    } else {
      if (isUptrend) {
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
    }
    result.push({ time: data[dataIdx].time, value: superTrend });
  }
  return result;
}

/**
 * Calculate VWMA (Volume Weighted Moving Average)
 */
export function calculateVWMA(data: ChartDataPoint[], period: number = 20): IndicatorDataPoint[] {
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
}

// ============================================================================
// ADVANCED VOLUME INDICATORS
// ============================================================================

/**
 * Calculate CMF (Chaikin Money Flow)
 */
export function calculateCMF(data: ChartDataPoint[], period: number = 20): IndicatorDataPoint[] {
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
}

/**
 * Calculate A/D Line (Accumulation/Distribution Line)
 */
export function calculateADLine(data: ChartDataPoint[]): IndicatorDataPoint[] {
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
}

// ============================================================================
// MOMENTUM INDICATORS
// ============================================================================

/**
 * Calculate ROC (Rate of Change)
 */
export function calculateROC(data: ChartDataPoint[], period: number = 12): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];
  if (data.length <= period) return result;

  for (let i = period; i < data.length; i++) {
    const prevClose = data[i - period].close;
    const roc = prevClose === 0 ? 0 : ((data[i].close - prevClose) / prevClose) * 100;
    result.push({ time: data[i].time, value: roc });
  }
  return result;
}

/**
 * Calculate Momentum
 */
export function calculateMomentum(
  data: ChartDataPoint[],
  period: number = 10
): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];
  if (data.length <= period) return result;

  for (let i = period; i < data.length; i++) {
    result.push({ time: data[i].time, value: data[i].close - data[i - period].close });
  }
  return result;
}

/**
 * Calculate TSI (True Strength Index)
 */
export function calculateTSI(
  data: ChartDataPoint[],
  longPeriod: number = 25,
  shortPeriod: number = 13
): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];
  if (data.length < longPeriod + shortPeriod) return result;

  const changes: number[] = [];
  const absChanges: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    changes.push(change);
    absChanges.push(Math.abs(change));
  }

  const doubleEMA = (values: number[], long: number, short: number): number[] => {
    const firstEMA: number[] = [];
    let ema1 = values.slice(0, long).reduce((a, b) => a + b, 0) / long;
    const mult1 = 2 / (long + 1);

    for (let i = long - 1; i < values.length; i++) {
      if (i === long - 1) firstEMA.push(ema1);
      else {
        ema1 = (values[i] - ema1) * mult1 + ema1;
        firstEMA.push(ema1);
      }
    }

    const secondEMA: number[] = [];
    let ema2 = firstEMA.slice(0, short).reduce((a, b) => a + b, 0) / short;
    const mult2 = 2 / (short + 1);

    for (let i = short - 1; i < firstEMA.length; i++) {
      if (i === short - 1) secondEMA.push(ema2);
      else {
        ema2 = (firstEMA[i] - ema2) * mult2 + ema2;
        secondEMA.push(ema2);
      }
    }
    return secondEMA;
  };

  const smoothedChanges = doubleEMA(changes, longPeriod, shortPeriod);
  const smoothedAbsChanges = doubleEMA(absChanges, longPeriod, shortPeriod);
  const startIdx = longPeriod + shortPeriod - 1;

  for (let i = 0; i < smoothedChanges.length; i++) {
    const tsi =
      smoothedAbsChanges[i] === 0 ? 0 : (100 * smoothedChanges[i]) / smoothedAbsChanges[i];
    result.push({ time: data[startIdx + i].time, value: tsi });
  }
  return result;
}
