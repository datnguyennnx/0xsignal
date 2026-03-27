/**
 * Indicator calculation dispatcher
 * Centralizes indicator calculation logic for chart components
 */

import type { ChartDataPoint } from "../types/chart";
import type { IndicatorDataPoint, BandIndicatorDataPoint } from "./types";
import type { ActiveIndicator } from "./config";
import { getIndicatorBaseId } from "./config";
import { INDICATOR_TYPE } from "../patterns/constants";
import { isBandIndicator } from "./metadata";
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

const calculateTrendIndicator = (
  baseId: string,
  data: ChartDataPoint[],
  params: ActiveIndicator["params"]
): IndicatorDataPoint[] | null => {
  switch (baseId) {
    case INDICATOR_TYPE.SMA:
      return calculateSMA(data, params.period || 20);
    case INDICATOR_TYPE.EMA:
      return calculateEMA(data, params.period || 20);
    case INDICATOR_TYPE.WMA:
      return calculateWMAIndicator(data, params.period || 20);
    case INDICATOR_TYPE.HMA:
      return calculateHMAIndicator(data, params.period || 21);
    case INDICATOR_TYPE.VWMA:
      return calculateVWMA(data, params.period || 20);
    case INDICATOR_TYPE.VWAP:
      return calculateVWAP(data);
    case INDICATOR_TYPE.SUPER_TREND:
      return calculateSuperTrend(data, params.period || 10, params.multiplier || 3);
    case INDICATOR_TYPE.PARABOLIC_SAR:
      return calculateParabolicSAR(data, params.step || 0.02, params.maxStep || 0.2);
    case INDICATOR_TYPE.ADX:
      return calculateADX(data, params.period || 14);
    default:
      return null;
  }
};

const calculateMomentumIndicator = (
  baseId: string,
  data: ChartDataPoint[],
  params: ActiveIndicator["params"]
): IndicatorDataPoint[] | null => {
  switch (baseId) {
    case INDICATOR_TYPE.RSI:
      return calculateRSI(data, params.period || 14);
    case INDICATOR_TYPE.MACD:
      return calculateMACDLine(data, params.fast || 12, params.slow || 26);
    case INDICATOR_TYPE.STOCHASTIC:
      return calculateStochasticK(data, params.period || 14);
    case INDICATOR_TYPE.AO:
      return calculateAO(data, params.fast || 5, params.slow || 34);
    case INDICATOR_TYPE.UO:
      return calculateUO(data, params.short || 7, params.medium || 14, params.long || 28);
    case INDICATOR_TYPE.WILLIAMS_R:
      return calculateWilliamsR(data, params.period || 14);
    case INDICATOR_TYPE.CCI:
      return calculateCCI(data, params.period || 20);
    case INDICATOR_TYPE.ROC:
      return calculateROC(data, params.period || 12);
    case INDICATOR_TYPE.MOMENTUM:
      return calculateMomentum(data, params.period || 10);
    case INDICATOR_TYPE.TSI:
      return calculateTSI(data, params.longPeriod || 25, params.shortPeriod || 13);
    case INDICATOR_TYPE.ZSCORE:
      return calculateZScoreIndicator(data, params.period || 30);
    case INDICATOR_TYPE.STDDEV:
      return calculateStdDevIndicator(data, params.period || 20);
    case INDICATOR_TYPE.LIN_REG_SLOPE:
      return calculateLinRegSlopeIndicator(data, params.period || 50);
    case INDICATOR_TYPE.ATRP:
      return calculateATRPIndicator(data, params.period || 14);
    case INDICATOR_TYPE.CHOP:
      return calculateChoppinessIndicator(data, params.period || 14);
    case INDICATOR_TYPE.EFFICIENCY_RATIO:
      return calculateEfficiencyRatioIndicator(data, params.period || 10);
    case INDICATOR_TYPE.STC:
      return calculateSTCIndicator(
        data,
        params.fast || 23,
        params.slow || 50,
        params.cycle || 10,
        params.smooth || 3
      );
    case INDICATOR_TYPE.DVO:
      return calculateDVOIndicator(data, params.maPeriod || 2, params.rankPeriod || 126);
    case INDICATOR_TYPE.KRI:
      return calculateKRIIndicator(data, params.period || 14);
    case INDICATOR_TYPE.VZO:
      return calculateVZOIndicator(data, params.period || 14);
    case INDICATOR_TYPE.VORTEX:
      return calculateVortexIndicator(data, params.period || 14);
    case INDICATOR_TYPE.PPO:
      return calculatePPOIndicator(data, params.fast || 12, params.slow || 26);
    case INDICATOR_TYPE.TRIX:
      return calculateTRIXIndicator(data, params.period || 18);
    case INDICATOR_TYPE.STOCH_RSI:
      return calculateStochRSIIndicator(
        data,
        params.rsiPeriod || 14,
        params.stochPeriod || 14,
        params.smoothK || 3
      );
    case INDICATOR_TYPE.VOLUME_OSC:
      return calculateVolumeOscillatorIndicator(data, params.short || 14, params.long || 28);
    case INDICATOR_TYPE.CHAIKIN_OSC:
      return calculateChaikinOscillatorIndicator(data, params.fast || 3, params.slow || 10);
    case INDICATOR_TYPE.EOM:
      return calculateEOMIndicator(data, params.period || 14);
    case INDICATOR_TYPE.HIST_VOL:
      return calculateHistoricalVolatilityIndicator(
        data,
        params.period || 20,
        params.annualization || 365
      );
    case INDICATOR_TYPE.AROON_OSC:
      return calculateAroonOscillatorIndicator(data, params.period || 25);
    default:
      return null;
  }
};

const calculateVolumeIndicator = (
  baseId: string,
  data: ChartDataPoint[],
  params: ActiveIndicator["params"]
): IndicatorDataPoint[] | null => {
  switch (baseId) {
    case INDICATOR_TYPE.OBV:
      return calculateOBV(data);
    case INDICATOR_TYPE.MFI:
      return calculateMFI(data, params.period || 14);
    case INDICATOR_TYPE.PVT:
      return calculatePVT(data);
    case INDICATOR_TYPE.NVI:
      return calculateNVI(data);
    case INDICATOR_TYPE.CMF:
      return calculateCMF(data, params.period || 20);
    case INDICATOR_TYPE.AD_LINE:
      return calculateADLine(data);
    default:
      return null;
  }
};

const calculateVolatilityIndicator = (
  baseId: string,
  data: ChartDataPoint[],
  params: ActiveIndicator["params"]
): IndicatorDataPoint[] | null => {
  switch (baseId) {
    case INDICATOR_TYPE.ATR:
      return calculateATR(data, params.period || 14);
    default:
      return null;
  }
};

/**
 * Calculate a line indicator (single value per point)
 */
export const calculateLineIndicator = (
  indicator: ActiveIndicator,
  data: ChartDataPoint[]
): IndicatorDataPoint[] | null => {
  const baseId = getIndicatorBaseId(indicator.config.id);
  const { params } = indicator;

  return (
    calculateTrendIndicator(baseId, data, params) ||
    calculateMomentumIndicator(baseId, data, params) ||
    calculateVolumeIndicator(baseId, data, params) ||
    calculateVolatilityIndicator(baseId, data, params) ||
    null
  );
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
    case INDICATOR_TYPE.BOLLINGER_BANDS:
      return calculateBollingerBands(data, params.period || 20, params.stdDev || 2);
    case INDICATOR_TYPE.KELTNER_CHANNELS:
      return calculateKeltnerChannels(data, params.period || 20, params.multiplier || 2);
    case INDICATOR_TYPE.DONCHIAN_CHANNELS:
      return calculateDonchianChannels(data, params.period || 20);
    default:
      return null;
  }
};

export { isBandIndicator };
