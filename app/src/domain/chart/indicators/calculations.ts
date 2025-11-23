// ============================================================================
// INDICATOR CALCULATION LIBRARY
// ============================================================================
// Consolidated indicator calculations for chart visualization
// All formulas are pure functions that work with ChartDataPoint arrays
// ============================================================================

import type { ChartDataPoint } from "@/domain/chart/types";
import type { Time } from "lightweight-charts";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface IndicatorDataPoint {
  time: Time;
  value: number;
}

export interface BandIndicatorDataPoint {
  time: Time;
  upper: number;
  middle: number;
  lower: number;
}

export interface MACDDataPoint {
  macd: IndicatorDataPoint[];
  signal: IndicatorDataPoint[];
  histogram: IndicatorDataPoint[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate mean of an array
 */
function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate True Range
 */
function calculateTrueRange(high: number, low: number, previousClose: number): number {
  const range1 = high - low;
  const range2 = Math.abs(high - previousClose);
  const range3 = Math.abs(low - previousClose);
  return Math.max(range1, range2, range3);
}

// ============================================================================
// TREND INDICATORS
// ============================================================================

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: ChartDataPoint[], period: number): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];

  // Check if we have enough data
  if (data.length < period) {
    return result; // Return empty array if insufficient data
  }

  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
    result.push({
      time: data[i].time as Time,
      value: sum / period,
    });
  }

  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: ChartDataPoint[], period: number): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];

  // Check if we have enough data
  if (data.length < period) {
    return result; // Return empty array if insufficient data
  }

  const multiplier = 2 / (period + 1);

  // Start with SMA
  let ema = data.slice(0, period).reduce((acc, d) => acc + d.close, 0) / period;
  result.push({ time: data[period - 1].time as Time, value: ema });

  // Calculate EMA
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({ time: data[i].time as Time, value: ema });
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

    // Calculate SMA (middle band)
    const sma = closes.reduce((acc, val) => acc + val, 0) / period;

    // Calculate standard deviation
    const variance = closes.reduce((acc, val) => acc + Math.pow(val - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    result.push({
      time: data[i].time as Time,
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

  // Calculate True Range series
  for (let i = 1; i < data.length; i++) {
    const tr = calculateTrueRange(data[i].high, data[i].low, data[i - 1].close);
    trSeries.push(tr);
  }

  // Calculate ATR using EMA
  const multiplier = 2 / (period + 1);
  let atr = trSeries.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push({ time: data[period].time as Time, value: atr });

  for (let i = period; i < trSeries.length; i++) {
    atr = trSeries[i] * multiplier + atr * (1 - multiplier);
    result.push({ time: data[i + 1].time as Time, value: atr });
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

  // Align data (ATR starts later)
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
    const middle = (upper + lower) / 2;

    result.push({
      time: data[i].time as Time,
      upper,
      middle,
      lower,
    });
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

  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // Calculate initial average gain/loss
  let avgGain = gains.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((acc, val) => acc + val, 0) / period;

  // Calculate RSI
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    result.push({
      time: data[i + 1].time as Time,
      value: rsi,
    });
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
): MACDDataPoint {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  // Calculate MACD line
  const macdLine: IndicatorDataPoint[] = [];
  const startIndex = slowPeriod - fastPeriod;

  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push({
      time: slowEMA[i].time,
      value: fastEMA[i + startIndex].value - slowEMA[i].value,
    });
  }

  // Calculate signal line (EMA of MACD)
  const signalLine: IndicatorDataPoint[] = [];
  const multiplier = 2 / (signalPeriod + 1);
  let ema = macdLine.slice(0, signalPeriod).reduce((acc, d) => acc + d.value, 0) / signalPeriod;

  signalLine.push({
    time: macdLine[signalPeriod - 1].time,
    value: ema,
  });

  for (let i = signalPeriod; i < macdLine.length; i++) {
    ema = (macdLine[i].value - ema) * multiplier + ema;
    signalLine.push({ time: macdLine[i].time, value: ema });
  }

  // Calculate histogram
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
): { k: IndicatorDataPoint[]; d: IndicatorDataPoint[] } {
  const kSeries: IndicatorDataPoint[] = [];

  // Calculate %K
  for (let i = kPeriod - 1; i < data.length; i++) {
    const slice = data.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map((d) => d.high));
    const low = Math.min(...slice.map((d) => d.low));
    const close = data[i].close;

    const k = high === low ? 50 : ((close - low) / (high - low)) * 100;

    kSeries.push({
      time: data[i].time as Time,
      value: k,
    });
  }

  // Calculate %D (SMA of %K)
  const dSeries: IndicatorDataPoint[] = [];
  for (let i = dPeriod - 1; i < kSeries.length; i++) {
    const window = kSeries.slice(i - dPeriod + 1, i + 1);
    const d = window.reduce((acc, val) => acc + val.value, 0) / dPeriod;

    dSeries.push({
      time: kSeries[i].time,
      value: d,
    });
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
    const close = data[i].close;

    const value = high === low ? -50 : -100 * ((high - close) / (high - low));

    result.push({
      time: data[i].time as Time,
      value,
    });
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
  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    cumulativeTPV += typicalPrice * data[i].volume;
    cumulativeVolume += data[i].volume;

    result.push({
      time: data[i].time as Time,
      value: cumulativeTPV / cumulativeVolume,
    });
  }

  return result;
}

/**
 * Calculate OBV (On-Balance Volume)
 */
export function calculateOBV(data: ChartDataPoint[]): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];
  let obv = 0;

  result.push({ time: data[0].time as Time, value: 0 });

  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) {
      obv += data[i].volume;
    } else if (data[i].close < data[i - 1].close) {
      obv -= data[i].volume;
    }

    result.push({
      time: data[i].time as Time,
      value: obv,
    });
  }

  return result;
}

/**
 * Calculate MFI (Money Flow Index)
 */
export function calculateMFI(data: ChartDataPoint[], period: number = 14): IndicatorDataPoint[] {
  const result: IndicatorDataPoint[] = [];

  // Calculate typical prices and raw money flow
  const typicalPrices: number[] = [];
  const rawMoneyFlow: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3;
    typicalPrices.push(tp);
    rawMoneyFlow.push(tp * data[i].volume);
  }

  // Calculate MFI for each point
  for (let i = period; i < data.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        positiveFlow += rawMoneyFlow[j];
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negativeFlow += rawMoneyFlow[j];
      }
    }

    const ratio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
    const mfi = 100 - 100 / (1 + ratio);

    result.push({
      time: data[i].time as Time,
      value: mfi,
    });
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

  // Calculate typical prices
  const typicalPrices: number[] = [];
  for (let i = 0; i < data.length; i++) {
    typicalPrices.push((data[i].high + data[i].low + data[i].close) / 3);
  }

  // Calculate CCI for each point
  for (let i = period - 1; i < data.length; i++) {
    const window = typicalPrices.slice(i - period + 1, i + 1);
    const sma = mean(window);
    const deviations = window.map((tp) => Math.abs(tp - sma));
    const meanDeviation = mean(deviations);
    const currentTP = typicalPrices[i];
    const cci = meanDeviation === 0 ? 0 : (currentTP - sma) / (0.015 * meanDeviation);

    result.push({
      time: data[i].time as Time,
      value: cci,
    });
  }

  return result;
}
