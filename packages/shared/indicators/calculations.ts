/**
 * Indicator calculations - shared between frontend and backend
 * Pure functions using shared math utilities
 */

import type { ChartDataPoint } from "../types/chart";
import type { IndicatorDataPoint, BandIndicatorDataPoint } from "./types";
import {
  calculateEMA as calculateEMAFromTrend,
  calculateHMA,
  calculateParabolicSAR as calculateParabolicSARFromTrend,
  calculateSMA as calculateSMAFromTrend,
  calculateSuperTrend as calculateSuperTrendFromTrend,
  calculateWMA,
  calculateVWMA as calculateVWMAFromTrend,
  calculateADX as calculateADXFromTrend,
} from "./calculators/trend";
import {
  calculateATR as calculateATRFromVolatility,
  calculateBollingerBands as calculateBollingerBandsFromVolatility,
  calculateDonchianChannels as calculateDonchianChannelsFromVolatility,
} from "./calculators/volatility";
import {
  calculateAwesomeOscillator,
  calculateMACDLine as calculateMACDLineFromMomentum,
  calculateRSI as calculateRSIFromMomentum,
  calculateStochasticK as calculateStochasticKFromMomentum,
  calculateUltimateOscillator,
  calculateWilliamsR as calculateWilliamsRFromMomentum,
  calculateCCI as calculateCCIFromMomentum,
  calculateROC as calculateROCFromMomentum,
  calculateMomentum as calculateMomentumFromMomentum,
  calculateTSI as calculateTSIFromMomentum,
} from "./calculators/momentum";
import {
  calculateNVI as calculateNVIFromVolume,
  calculateOBV as calculateOBVFromVolume,
  calculatePVT as calculatePVTFromVolume,
  calculateVWAP as calculateVWAPFromVolume,
  calculateMFI as calculateMFIFromVolume,
  calculateCMF as calculateCMFFromVolume,
  calculateADLine as calculateADLineFromVolume,
} from "./calculators/volume";
import {
  calculateRegressionSlope,
  calculateStandardDeviation,
  calculateZScore,
} from "./calculators/statistics";
import { calculateATRP, calculateChoppiness, calculateEfficiencyRatio } from "./calculators/regime";
import {
  calculateDVO,
  calculateKRI,
  calculateSTC,
  calculateVortexSpread,
  calculateVZO,
} from "./calculators/advanced";
import {
  calculateAroonOscillator,
  calculateChaikinOscillator,
  calculateEaseOfMovement,
  calculateHistoricalVolatility,
  calculatePPO,
  calculateStochRSI,
  calculateTRIX,
  calculateVolumeOscillator,
} from "./calculators/quant";

// Re-exports with original names for compatibility

// Trend indicators
export function calculateSMA(data: ChartDataPoint[], period: number): IndicatorDataPoint[] {
  return calculateSMAFromTrend(data, period);
}
export function calculateEMA(data: ChartDataPoint[], period: number): IndicatorDataPoint[] {
  return calculateEMAFromTrend(data, period);
}
export function calculateWMAIndicator(
  data: ChartDataPoint[],
  period: number = 20
): IndicatorDataPoint[] {
  return calculateWMA(data, period);
}
export function calculateHMAIndicator(
  data: ChartDataPoint[],
  period: number = 21
): IndicatorDataPoint[] {
  return calculateHMA(data, period);
}
export function calculateADX(data: ChartDataPoint[], period: number = 14): IndicatorDataPoint[] {
  return calculateADXFromTrend(data, period);
}
export function calculateParabolicSAR(
  data: ChartDataPoint[],
  step: number = 0.02,
  maxStep: number = 0.2
): IndicatorDataPoint[] {
  return calculateParabolicSARFromTrend(data, step, maxStep);
}
export function calculateSuperTrend(
  data: ChartDataPoint[],
  period: number = 10,
  multiplier: number = 3
): IndicatorDataPoint[] {
  return calculateSuperTrendFromTrend(data, period, multiplier);
}
export function calculateVWMA(data: ChartDataPoint[], period: number = 20): IndicatorDataPoint[] {
  return calculateVWMAFromTrend(data, period);
}

// Volatility indicators
export function calculateBollingerBands(
  data: ChartDataPoint[],
  period: number = 20,
  stdDev: number = 2
): BandIndicatorDataPoint[] {
  return calculateBollingerBandsFromVolatility(data, period, stdDev);
}
export function calculateATR(data: ChartDataPoint[], period: number = 14): IndicatorDataPoint[] {
  return calculateATRFromVolatility(data, period);
}
export function calculateDonchianChannels(
  data: ChartDataPoint[],
  period: number = 20
): BandIndicatorDataPoint[] {
  return calculateDonchianChannelsFromVolatility(data, period);
}
export function calculateKeltnerChannels(
  data: ChartDataPoint[],
  period: number = 20,
  multiplier: number = 2
): BandIndicatorDataPoint[] {
  const middleSeries = calculateEMA(data, period);
  const atrSeries = calculateATR(data, period);
  const result: BandIndicatorDataPoint[] = [];
  const offset = data.length - atrSeries.length;
  for (let i = 0; i < atrSeries.length; i++) {
    const index = i + offset;
    if (index < 0 || index >= middleSeries.length) continue;
    const m = middleSeries[index];
    if (!m) continue;
    const atr = atrSeries[i].value;
    result.push({
      time: atrSeries[i].time,
      upper: m.value + multiplier * atr,
      middle: m.value,
      lower: m.value - multiplier * atr,
    });
  }
  return result;
}

// Momentum indicators
export function calculateRSI(data: ChartDataPoint[], period: number = 14): IndicatorDataPoint[] {
  return calculateRSIFromMomentum(data, period);
}
export function calculateMACDLine(
  data: ChartDataPoint[],
  fastPeriod: number = 12,
  slowPeriod: number = 26
): IndicatorDataPoint[] {
  return calculateMACDLineFromMomentum(data, fastPeriod, slowPeriod, calculateEMAFromTrend);
}
export function calculateStochasticK(
  data: ChartDataPoint[],
  kPeriod: number = 14
): IndicatorDataPoint[] {
  return calculateStochasticKFromMomentum(data, kPeriod);
}
export function calculateWilliamsR(
  data: ChartDataPoint[],
  period: number = 14
): IndicatorDataPoint[] {
  return calculateWilliamsRFromMomentum(data, period);
}
export function calculateAO(
  data: ChartDataPoint[],
  fastPeriod: number = 5,
  slowPeriod: number = 34
): IndicatorDataPoint[] {
  return calculateAwesomeOscillator(data, fastPeriod, slowPeriod);
}
export function calculateUO(
  data: ChartDataPoint[],
  short: number = 7,
  med: number = 14,
  long: number = 28
): IndicatorDataPoint[] {
  return calculateUltimateOscillator(data, short, med, long);
}
export function calculateCCI(data: ChartDataPoint[], period: number = 20): IndicatorDataPoint[] {
  return calculateCCIFromMomentum(data, period);
}
export function calculateROC(data: ChartDataPoint[], period: number = 12): IndicatorDataPoint[] {
  return calculateROCFromMomentum(data, period);
}
export function calculateMomentum(
  data: ChartDataPoint[],
  period: number = 10
): IndicatorDataPoint[] {
  return calculateMomentumFromMomentum(data, period);
}
export function calculateTSI(
  data: ChartDataPoint[],
  long: number = 25,
  short: number = 13
): IndicatorDataPoint[] {
  return calculateTSIFromMomentum(data, long, short);
}

// Volume indicators
export function calculateVWAP(data: ChartDataPoint[]): IndicatorDataPoint[] {
  return calculateVWAPFromVolume(data);
}
export function calculateOBV(data: ChartDataPoint[]): IndicatorDataPoint[] {
  return calculateOBVFromVolume(data);
}
export function calculatePVT(data: ChartDataPoint[]): IndicatorDataPoint[] {
  return calculatePVTFromVolume(data);
}
export function calculateNVI(data: ChartDataPoint[]): IndicatorDataPoint[] {
  return calculateNVIFromVolume(data);
}
export function calculateMFI(data: ChartDataPoint[], period: number = 14): IndicatorDataPoint[] {
  return calculateMFIFromVolume(data, period);
}
export function calculateCMF(data: ChartDataPoint[], period: number = 20): IndicatorDataPoint[] {
  return calculateCMFFromVolume(data, period);
}
export function calculateADLine(data: ChartDataPoint[]): IndicatorDataPoint[] {
  return calculateADLineFromVolume(data);
}

// Statistics indicators
export function calculateZScoreIndicator(
  data: ChartDataPoint[],
  period: number = 30
): IndicatorDataPoint[] {
  return calculateZScore(data, period);
}
export function calculateStdDevIndicator(
  data: ChartDataPoint[],
  period: number = 20
): IndicatorDataPoint[] {
  return calculateStandardDeviation(data, period);
}
export function calculateLinRegSlopeIndicator(
  data: ChartDataPoint[],
  period: number = 50
): IndicatorDataPoint[] {
  return calculateRegressionSlope(data, period);
}

// Regime indicators
export function calculateATRPIndicator(
  data: ChartDataPoint[],
  period: number = 14
): IndicatorDataPoint[] {
  return calculateATRP(data, period);
}
export function calculateChoppinessIndicator(
  data: ChartDataPoint[],
  period: number = 14
): IndicatorDataPoint[] {
  return calculateChoppiness(data, period);
}
export function calculateEfficiencyRatioIndicator(
  data: ChartDataPoint[],
  period: number = 10
): IndicatorDataPoint[] {
  return calculateEfficiencyRatio(data, period);
}

// Advanced indicators
export function calculateSTCIndicator(
  data: ChartDataPoint[],
  f: number,
  s: number,
  c: number,
  sm: number
): IndicatorDataPoint[] {
  return calculateSTC(data, f, s, c, sm);
}
export function calculateDVOIndicator(
  data: ChartDataPoint[],
  ma: number,
  rank: number
): IndicatorDataPoint[] {
  return calculateDVO(data, ma, rank);
}
export function calculateKRIIndicator(data: ChartDataPoint[], p: number): IndicatorDataPoint[] {
  return calculateKRI(data, p);
}
export function calculateVZOIndicator(data: ChartDataPoint[], p: number): IndicatorDataPoint[] {
  return calculateVZO(data, p);
}
export function calculateVortexIndicator(data: ChartDataPoint[], p: number): IndicatorDataPoint[] {
  return calculateVortexSpread(data, p);
}

// Quant indicators
export function calculatePPOIndicator(
  data: ChartDataPoint[],
  f: number,
  s: number
): IndicatorDataPoint[] {
  return calculatePPO(data, f, s);
}
export function calculateTRIXIndicator(data: ChartDataPoint[], p: number): IndicatorDataPoint[] {
  return calculateTRIX(data, p);
}
export function calculateStochRSIIndicator(
  data: ChartDataPoint[],
  r: number,
  st: number,
  sm: number
): IndicatorDataPoint[] {
  return calculateStochRSI(data, r, st, sm);
}
export function calculateVolumeOscillatorIndicator(
  data: ChartDataPoint[],
  s: number,
  l: number
): IndicatorDataPoint[] {
  return calculateVolumeOscillator(data, s, l);
}
export function calculateChaikinOscillatorIndicator(
  data: ChartDataPoint[],
  f: number,
  s: number
): IndicatorDataPoint[] {
  return calculateChaikinOscillator(data, f, s);
}
export function calculateEOMIndicator(data: ChartDataPoint[], p: number): IndicatorDataPoint[] {
  return calculateEaseOfMovement(data, p);
}
export function calculateHistoricalVolatilityIndicator(
  data: ChartDataPoint[],
  p: number,
  ann: number
): IndicatorDataPoint[] {
  return calculateHistoricalVolatility(data, p, ann);
}
export function calculateAroonOscillatorIndicator(
  data: ChartDataPoint[],
  p: number
): IndicatorDataPoint[] {
  return calculateAroonOscillator(data, p);
}
