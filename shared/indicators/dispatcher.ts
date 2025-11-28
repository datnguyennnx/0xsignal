/**
 * Indicator calculation dispatcher
 * Centralizes indicator calculation logic for chart components
 */

import type { ChartDataPoint } from "../types/chart";
import type { IndicatorDataPoint, BandIndicatorDataPoint } from "./types";
import type { ActiveIndicator } from "./config";
import {
  calculateSMA,
  calculateEMA,
  calculateVWAP,
  calculateVWMA,
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  calculateATR,
  calculateCCI,
  calculateWilliamsR,
  calculateOBV,
  calculateMFI,
  calculateBollingerBands,
  calculateKeltnerChannels,
  calculateDonchianChannels,
  calculateADX,
  calculateParabolicSAR,
  calculateSuperTrend,
  calculateCMF,
  calculateADLine,
  calculateROC,
  calculateMomentum,
  calculateTSI,
} from "./calculations";
import { BAND_INDICATORS } from "./metadata";

/**
 * Calculate a line indicator (single value per point)
 */
export const calculateLineIndicator = (
  indicator: ActiveIndicator,
  data: ChartDataPoint[]
): IndicatorDataPoint[] | null => {
  const baseId = indicator.config.id.split("-")[0];
  const { params } = indicator;

  switch (baseId) {
    // Trend indicators
    case "sma":
      return calculateSMA(data, params.period || 20);
    case "ema":
      return calculateEMA(data, params.period || 20);
    case "vwma":
      return calculateVWMA(data, params.period || 20);
    case "vwap":
      return calculateVWAP(data);
    case "superTrend":
      return calculateSuperTrend(data, params.period || 10, params.multiplier || 3);
    case "parabolicSAR":
      return calculateParabolicSAR(data, params.step || 0.02, params.maxStep || 0.2);
    case "adx":
      return calculateADX(data, params.period || 14);

    // Momentum indicators
    case "rsi":
      return calculateRSI(data, params.period || 14);
    case "macd":
      return calculateMACD(data, params.fast || 12, params.slow || 26, params.signal || 9).macd;
    case "stochastic":
      return calculateStochastic(data, params.period || 14, params.smoothD || 3).k;
    case "williamsR":
      return calculateWilliamsR(data, params.period || 14);
    case "cci":
      return calculateCCI(data, params.period || 20);
    case "roc":
      return calculateROC(data, params.period || 12);
    case "momentum":
      return calculateMomentum(data, params.period || 10);
    case "tsi":
      return calculateTSI(data, params.longPeriod || 25, params.shortPeriod || 13);

    // Volatility indicators
    case "atr":
      return calculateATR(data, params.period || 14);

    // Volume indicators
    case "obv":
      return calculateOBV(data);
    case "mfi":
      return calculateMFI(data, params.period || 14);
    case "cmf":
      return calculateCMF(data, params.period || 20);
    case "adLine":
      return calculateADLine(data);

    default:
      return null;
  }
};

/**
 * Calculate a band indicator (upper/middle/lower)
 */
export const calculateBandIndicator = (
  indicator: ActiveIndicator,
  data: ChartDataPoint[]
): BandIndicatorDataPoint[] | null => {
  const baseId = indicator.config.id.split("-")[0];
  const { params } = indicator;

  switch (baseId) {
    case "bollingerBands":
      return calculateBollingerBands(data, params.period || 20, params.stdDev || 2);
    case "keltnerChannels":
      return calculateKeltnerChannels(data, params.period || 20, params.multiplier || 2);
    case "donchianChannels":
      return calculateDonchianChannels(data, params.period || 20);
    default:
      return null;
  }
};

/**
 * Check if indicator is a band type
 */
export const isBandIndicator = (indicatorId: string): boolean => {
  const baseId = indicatorId.split("-")[0];
  return BAND_INDICATORS.includes(baseId as (typeof BAND_INDICATORS)[number]);
};
