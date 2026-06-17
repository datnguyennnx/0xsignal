import type { ChartDataPoint } from "../types/chart";
import type { IndicatorDataPoint, BandIndicatorDataPoint } from "./types";
import type { ActiveIndicator } from "./config";
import { getIndicatorBaseId } from "./config";
import { INDICATOR_TYPE } from "./constants";
import { isBandIndicator, isHistogramIndicator } from "./metadata";
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

export type LineCalculator = (
  data: ChartDataPoint[],
  params: Record<string, number>,
) => IndicatorDataPoint[] | null;

export type BandCalculator = (
  data: ChartDataPoint[],
  params: Record<string, number>,
) => BandIndicatorDataPoint[] | null;

export const LINE_INDICATOR_MAP = new Map<string, LineCalculator>([
  [INDICATOR_TYPE.SMA, (data, p) => calculateSMA(data, p.period || 20)],
  [INDICATOR_TYPE.EMA, (data, p) => calculateEMA(data, p.period || 20)],
  [INDICATOR_TYPE.WMA, (data, p) => calculateWMAIndicator(data, p.period || 20)],
  [INDICATOR_TYPE.HMA, (data, p) => calculateHMAIndicator(data, p.period || 21)],
  [INDICATOR_TYPE.VWMA, (data, p) => calculateVWMA(data, p.period || 20)],
  [INDICATOR_TYPE.VWAP, (data) => calculateVWAP(data)],
  [
    INDICATOR_TYPE.SUPER_TREND,
    (data, p) => calculateSuperTrend(data, p.period || 10, p.multiplier || 3),
  ],
  [
    INDICATOR_TYPE.PARABOLIC_SAR,
    (data, p) => calculateParabolicSAR(data, p.step || 0.02, p.maxStep || 0.2),
  ],
  [INDICATOR_TYPE.ADX, (data, p) => calculateADX(data, p.period || 14)],
  [INDICATOR_TYPE.RSI, (data, p) => calculateRSI(data, p.period || 14)],
  [INDICATOR_TYPE.MACD, (data, p) => calculateMACDLine(data, p.fast || 12, p.slow || 26)],
  [INDICATOR_TYPE.STOCHASTIC, (data, p) => calculateStochasticK(data, p.period || 14)],
  [INDICATOR_TYPE.AO, (data, p) => calculateAO(data, p.fast || 5, p.slow || 34)],
  [INDICATOR_TYPE.UO, (data, p) => calculateUO(data, p.short || 7, p.medium || 14, p.long || 28)],
  [INDICATOR_TYPE.WILLIAMS_R, (data, p) => calculateWilliamsR(data, p.period || 14)],
  [INDICATOR_TYPE.CCI, (data, p) => calculateCCI(data, p.period || 20)],
  [INDICATOR_TYPE.ROC, (data, p) => calculateROC(data, p.period || 12)],
  [INDICATOR_TYPE.MOMENTUM, (data, p) => calculateMomentum(data, p.period || 10)],
  [INDICATOR_TYPE.TSI, (data, p) => calculateTSI(data, p.longPeriod || 25, p.shortPeriod || 13)],
  [INDICATOR_TYPE.ZSCORE, (data, p) => calculateZScoreIndicator(data, p.period || 30)],
  [INDICATOR_TYPE.STDDEV, (data, p) => calculateStdDevIndicator(data, p.period || 20)],
  [INDICATOR_TYPE.LIN_REG_SLOPE, (data, p) => calculateLinRegSlopeIndicator(data, p.period || 50)],
  [INDICATOR_TYPE.ATRP, (data, p) => calculateATRPIndicator(data, p.period || 14)],
  [INDICATOR_TYPE.CHOP, (data, p) => calculateChoppinessIndicator(data, p.period || 14)],
  [
    INDICATOR_TYPE.EFFICIENCY_RATIO,
    (data, p) => calculateEfficiencyRatioIndicator(data, p.period || 10),
  ],
  [
    INDICATOR_TYPE.STC,
    (data, p) =>
      calculateSTCIndicator(data, p.fast || 23, p.slow || 50, p.cycle || 10, p.smooth || 3),
  ],
  [
    INDICATOR_TYPE.DVO,
    (data, p) => calculateDVOIndicator(data, p.maPeriod || 2, p.rankPeriod || 126),
  ],
  [INDICATOR_TYPE.KRI, (data, p) => calculateKRIIndicator(data, p.period || 14)],
  [INDICATOR_TYPE.VZO, (data, p) => calculateVZOIndicator(data, p.period || 14)],
  [INDICATOR_TYPE.VORTEX, (data, p) => calculateVortexIndicator(data, p.period || 14)],
  [INDICATOR_TYPE.PPO, (data, p) => calculatePPOIndicator(data, p.fast || 12, p.slow || 26)],
  [INDICATOR_TYPE.TRIX, (data, p) => calculateTRIXIndicator(data, p.period || 18)],
  [
    INDICATOR_TYPE.STOCH_RSI,
    (data, p) =>
      calculateStochRSIIndicator(data, p.rsiPeriod || 14, p.stochPeriod || 14, p.smoothK || 3),
  ],
  [
    INDICATOR_TYPE.VOLUME_OSC,
    (data, p) => calculateVolumeOscillatorIndicator(data, p.short || 14, p.long || 28),
  ],
  [
    INDICATOR_TYPE.CHAIKIN_OSC,
    (data, p) => calculateChaikinOscillatorIndicator(data, p.fast || 3, p.slow || 10),
  ],
  [INDICATOR_TYPE.EOM, (data, p) => calculateEOMIndicator(data, p.period || 14)],
  [
    INDICATOR_TYPE.HIST_VOL,
    (data, p) =>
      calculateHistoricalVolatilityIndicator(data, p.period || 20, p.annualization || 365),
  ],
  [INDICATOR_TYPE.AROON_OSC, (data, p) => calculateAroonOscillatorIndicator(data, p.period || 25)],
  [INDICATOR_TYPE.OBV, (data) => calculateOBV(data)],
  [INDICATOR_TYPE.MFI, (data, p) => calculateMFI(data, p.period || 14)],
  [INDICATOR_TYPE.PVT, (data) => calculatePVT(data)],
  [INDICATOR_TYPE.NVI, (data) => calculateNVI(data)],
  [INDICATOR_TYPE.CMF, (data, p) => calculateCMF(data, p.period || 20)],
  [INDICATOR_TYPE.AD_LINE, (data) => calculateADLine(data)],
  [INDICATOR_TYPE.ATR, (data, p) => calculateATR(data, p.period || 14)],
]);

export const BAND_INDICATOR_MAP = new Map<string, BandCalculator>([
  [
    INDICATOR_TYPE.BOLLINGER_BANDS,
    (data, p) => calculateBollingerBands(data, p.period || 20, p.stdDev || 2),
  ],
  [
    INDICATOR_TYPE.KELTNER_CHANNELS,
    (data, p) => calculateKeltnerChannels(data, p.period || 20, p.multiplier || 2),
  ],
  [INDICATOR_TYPE.DONCHIAN_CHANNELS, (data, p) => calculateDonchianChannels(data, p.period || 20)],
]);

export const calculateLineIndicator = (
  indicator: ActiveIndicator,
  data: ChartDataPoint[],
): IndicatorDataPoint[] | null => {
  const baseId = getIndicatorBaseId(indicator.config.id);
  const calculator = LINE_INDICATOR_MAP.get(baseId);
  return calculator ? calculator(data, indicator.params) : null;
};

export const calculateBandIndicator = (
  indicator: ActiveIndicator,
  data: ChartDataPoint[],
): BandIndicatorDataPoint[] | null => {
  const baseId = getIndicatorBaseId(indicator.config.id);
  const calculator = BAND_INDICATOR_MAP.get(baseId);
  return calculator ? calculator(data, indicator.params) : null;
};

export { isBandIndicator, isHistogramIndicator };
