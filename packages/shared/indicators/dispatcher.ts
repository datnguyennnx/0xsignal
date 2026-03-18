/**
 * Indicator calculation dispatcher
 * Centralizes indicator calculation logic for chart components
 */

import type { ChartDataPoint } from "../types/chart";
import type { IndicatorDataPoint, BandIndicatorDataPoint } from "./types";
import type { ActiveIndicator } from "./config";
import { getIndicatorBaseId } from "./config";
import {
  calculateSMA,
  calculateEMA,
  calculateWMAIndicator,
  calculateHMAIndicator,
  calculateVWAP,
  calculateVWMA,
  calculateRSI,
  calculateMACDLine,
  calculateStochasticK,
  calculateATR,
  calculateCCI,
  calculateWilliamsR,
  calculateOBV,
  calculatePVT,
  calculateNVI,
  calculateMFI,
  calculateBollingerBands,
  calculateKeltnerChannels,
  calculateDonchianChannels,
  calculateADX,
  calculateParabolicSAR,
  calculateSuperTrend,
  calculateAO,
  calculateUO,
  calculateZScoreIndicator,
  calculateStdDevIndicator,
  calculateLinRegSlopeIndicator,
  calculateATRPIndicator,
  calculateChoppinessIndicator,
  calculateEfficiencyRatioIndicator,
  calculateSTCIndicator,
  calculateDVOIndicator,
  calculateKRIIndicator,
  calculateVZOIndicator,
  calculateVortexIndicator,
  calculatePPOIndicator,
  calculateTRIXIndicator,
  calculateStochRSIIndicator,
  calculateVolumeOscillatorIndicator,
  calculateChaikinOscillatorIndicator,
  calculateEOMIndicator,
  calculateHistoricalVolatilityIndicator,
  calculateAroonOscillatorIndicator,
  calculateCMF,
  calculateADLine,
  calculateROC,
  calculateMomentum,
  calculateTSI,
} from "./calculations";
import { isBandIndicator } from "./metadata";

/**
 * Calculate a line indicator (single value per point)
 */
export const calculateLineIndicator = (
  indicator: ActiveIndicator,
  data: ChartDataPoint[]
): IndicatorDataPoint[] | null => {
  const baseId = getIndicatorBaseId(indicator.config.id);
  const { params } = indicator;

  switch (baseId) {
    // Trend indicators
    case "sma":
      return calculateSMA(data, params.period || 20);
    case "ema":
      return calculateEMA(data, params.period || 20);
    case "wma":
      return calculateWMAIndicator(data, params.period || 20);
    case "hma":
      return calculateHMAIndicator(data, params.period || 21);
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
      return calculateMACDLine(data, params.fast || 12, params.slow || 26);
    case "stochastic":
      return calculateStochasticK(data, params.period || 14);
    case "ao":
      return calculateAO(data, params.fast || 5, params.slow || 34);
    case "uo":
      return calculateUO(data, params.short || 7, params.medium || 14, params.long || 28);
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
    case "zscore":
      return calculateZScoreIndicator(data, params.period || 30);
    case "stddev":
      return calculateStdDevIndicator(data, params.period || 20);
    case "linRegSlope":
      return calculateLinRegSlopeIndicator(data, params.period || 50);
    case "atrp":
      return calculateATRPIndicator(data, params.period || 14);
    case "chop":
      return calculateChoppinessIndicator(data, params.period || 14);
    case "efficiencyRatio":
      return calculateEfficiencyRatioIndicator(data, params.period || 10);
    case "stc":
      return calculateSTCIndicator(
        data,
        params.fast || 23,
        params.slow || 50,
        params.cycle || 10,
        params.smooth || 3
      );
    case "dvo":
      return calculateDVOIndicator(data, params.maPeriod || 2, params.rankPeriod || 126);
    case "kri":
      return calculateKRIIndicator(data, params.period || 14);
    case "vzo":
      return calculateVZOIndicator(data, params.period || 14);
    case "vortex":
      return calculateVortexIndicator(data, params.period || 14);
    case "ppo":
      return calculatePPOIndicator(data, params.fast || 12, params.slow || 26);
    case "trix":
      return calculateTRIXIndicator(data, params.period || 18);
    case "stochRsi":
      return calculateStochRSIIndicator(
        data,
        params.rsiPeriod || 14,
        params.stochPeriod || 14,
        params.smoothK || 3
      );
    case "volumeOsc":
      return calculateVolumeOscillatorIndicator(data, params.short || 14, params.long || 28);
    case "chaikinOsc":
      return calculateChaikinOscillatorIndicator(data, params.fast || 3, params.slow || 10);
    case "eom":
      return calculateEOMIndicator(data, params.period || 14);
    case "histVol":
      return calculateHistoricalVolatilityIndicator(
        data,
        params.period || 20,
        params.annualization || 365
      );
    case "aroonOsc":
      return calculateAroonOscillatorIndicator(data, params.period || 25);

    // Volatility indicators
    case "atr":
      return calculateATR(data, params.period || 14);

    // Volume indicators
    case "obv":
      return calculateOBV(data);
    case "mfi":
      return calculateMFI(data, params.period || 14);
    case "pvt":
      return calculatePVT(data);
    case "nvi":
      return calculateNVI(data);
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
  const baseId = getIndicatorBaseId(indicator.config.id);
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

export { isBandIndicator };
