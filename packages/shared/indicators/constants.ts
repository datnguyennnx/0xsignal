import type { ChartDataPoint } from "../types/chart";
import type { BandIndicatorDataPoint, IndicatorConfig, IndicatorDataPoint } from "./types";
import { AVAILABLE_INDICATORS } from "./config";
import {
  calculateADLine,
  calculateADX,
  calculateAO,
  calculateAroonOscillatorIndicator,
  calculateATR,
  calculateATRPIndicator,
  calculateBollingerBands,
  calculateCCI,
  calculateChaikinOscillatorIndicator,
  calculateChoppinessIndicator,
  calculateCMF,
  calculateDonchianChannels,
  calculateDVOIndicator,
  calculateEfficiencyRatioIndicator,
  calculateEMA,
  calculateEOMIndicator,
  calculateHMAIndicator,
  calculateHistoricalVolatilityIndicator,
  calculateKeltnerChannels,
  calculateKRIIndicator,
  calculateLinRegSlopeIndicator,
  calculateMACDLine,
  calculateMFI,
  calculateMomentum,
  calculateNVI,
  calculateOBV,
  calculateParabolicSAR,
  calculatePPOIndicator,
  calculatePVT,
  calculateROC,
  calculateRSI,
  calculateSMA,
  calculateSTCIndicator,
  calculateStdDevIndicator,
  calculateStochasticK,
  calculateStochRSIIndicator,
  calculateSuperTrend,
  calculateTRIXIndicator,
  calculateTSI,
  calculateUO,
  calculateVortexIndicator,
  calculateVolumeOscillatorIndicator,
  calculateVWAP,
  calculateVWMA,
  calculateVZOIndicator,
  calculateWilliamsR,
  calculateWMAIndicator,
  calculateZScoreIndicator,
} from "./calculations";

export const INDICATOR_OUTPUT = {
  BAND: "band" as const,
  HISTOGRAM: "histogram" as const,
  LINE: "line" as const,
} as const;

export const INDICATOR_TYPE = {
  SMA: "sma",
  EMA: "ema",
  WMA: "wma",
  HMA: "hma",
  VWMA: "vwma",
  VWAP: "vwap",
  SUPER_TREND: "superTrend",
  PARABOLIC_SAR: "parabolicSAR",
  ADX: "adx",
  RSI: "rsi",
  MACD: "macd",
  STOCHASTIC: "stochastic",
  AO: "ao",
  UO: "uo",
  WILLIAMS_R: "williamsR",
  CCI: "cci",
  ROC: "roc",
  MOMENTUM: "momentum",
  TSI: "tsi",
  ZSCORE: "zscore",
  STDDEV: "stddev",
  LIN_REG_SLOPE: "linRegSlope",
  ATRP: "atrp",
  CHOP: "chop",
  EFFICIENCY_RATIO: "efficiencyRatio",
  STC: "stc",
  DVO: "dvo",
  KRI: "kri",
  VZO: "vzo",
  VORTEX: "vortex",
  PPO: "ppo",
  TRIX: "trix",
  STOCH_RSI: "stochRsi",
  VOLUME_OSC: "volumeOsc",
  CHAIKIN_OSC: "chaikinOsc",
  EOM: "eom",
  HIST_VOL: "histVol",
  AROON_OSC: "aroonOsc",
  ATR: "atr",
  OBV: "obv",
  MFI: "mfi",
  PVT: "pvt",
  NVI: "nvi",
  CMF: "cmf",
  AD_LINE: "adLine",
  BOLLINGER_BANDS: "bollingerBands",
  KELTNER_CHANNELS: "keltnerChannels",
  DONCHIAN_CHANNELS: "donchianChannels",
} as const;

export type IndicatorType = (typeof INDICATOR_TYPE)[keyof typeof INDICATOR_TYPE];

export type BandIndicatorType =
  | typeof INDICATOR_TYPE.BOLLINGER_BANDS
  | typeof INDICATOR_TYPE.KELTNER_CHANNELS
  | typeof INDICATOR_TYPE.DONCHIAN_CHANNELS;

export type LineIndicatorType = Exclude<IndicatorType, BandIndicatorType>;

type LineCalculator = (
  data: ChartDataPoint[],
  params: Record<string, number>,
) => IndicatorDataPoint[] | null;

type BandCalculator = (
  data: ChartDataPoint[],
  params: Record<string, number>,
) => BandIndicatorDataPoint[] | null;

type LineOutput = typeof INDICATOR_OUTPUT.LINE | typeof INDICATOR_OUTPUT.HISTOGRAM;

interface LineIndicatorDefinition {
  readonly id: IndicatorType;
  readonly output: LineOutput;
  readonly catalog: IndicatorConfig;
  readonly calculate: LineCalculator;
}

interface BandIndicatorDefinition {
  readonly id: IndicatorType;
  readonly output: typeof INDICATOR_OUTPUT.BAND;
  readonly catalog: IndicatorConfig;
  readonly calculate: BandCalculator;
}

export type IndicatorDefinition = LineIndicatorDefinition | BandIndicatorDefinition;

const LINE_CALCULATORS: Record<LineIndicatorType, LineCalculator> = {
  [INDICATOR_TYPE.SMA]: (data, params) => calculateSMA(data, params.period),
  [INDICATOR_TYPE.EMA]: (data, params) => calculateEMA(data, params.period),
  [INDICATOR_TYPE.WMA]: (data, params) => calculateWMAIndicator(data, params.period),
  [INDICATOR_TYPE.HMA]: (data, params) => calculateHMAIndicator(data, params.period),
  [INDICATOR_TYPE.VWMA]: (data, params) => calculateVWMA(data, params.period),
  [INDICATOR_TYPE.VWAP]: (data) => calculateVWAP(data),
  [INDICATOR_TYPE.SUPER_TREND]: (data, params) =>
    calculateSuperTrend(data, params.period, params.multiplier),
  [INDICATOR_TYPE.PARABOLIC_SAR]: (data, params) =>
    calculateParabolicSAR(data, params.step, params.maxStep),
  [INDICATOR_TYPE.ADX]: (data, params) => calculateADX(data, params.period),
  [INDICATOR_TYPE.RSI]: (data, params) => calculateRSI(data, params.period),
  [INDICATOR_TYPE.MACD]: (data, params) =>
    calculateMACDLine(data, params.fast, params.slow, calculateEMA),
  [INDICATOR_TYPE.STOCHASTIC]: (data, params) => calculateStochasticK(data, params.period),
  [INDICATOR_TYPE.AO]: (data, params) => calculateAO(data, params.fast, params.slow),
  [INDICATOR_TYPE.UO]: (data, params) =>
    calculateUO(data, params.short, params.medium, params.long),
  [INDICATOR_TYPE.WILLIAMS_R]: (data, params) => calculateWilliamsR(data, params.period),
  [INDICATOR_TYPE.CCI]: (data, params) => calculateCCI(data, params.period),
  [INDICATOR_TYPE.ROC]: (data, params) => calculateROC(data, params.period),
  [INDICATOR_TYPE.MOMENTUM]: (data, params) => calculateMomentum(data, params.period),
  [INDICATOR_TYPE.TSI]: (data, params) => calculateTSI(data, params.longPeriod, params.shortPeriod),
  [INDICATOR_TYPE.ZSCORE]: (data, params) => calculateZScoreIndicator(data, params.period),
  [INDICATOR_TYPE.STDDEV]: (data, params) => calculateStdDevIndicator(data, params.period),
  [INDICATOR_TYPE.LIN_REG_SLOPE]: (data, params) =>
    calculateLinRegSlopeIndicator(data, params.period),
  [INDICATOR_TYPE.ATRP]: (data, params) => calculateATRPIndicator(data, params.period),
  [INDICATOR_TYPE.CHOP]: (data, params) => calculateChoppinessIndicator(data, params.period),
  [INDICATOR_TYPE.EFFICIENCY_RATIO]: (data, params) =>
    calculateEfficiencyRatioIndicator(data, params.period),
  [INDICATOR_TYPE.STC]: (data, params) =>
    calculateSTCIndicator(data, params.fast, params.slow, params.cycle, params.smooth),
  [INDICATOR_TYPE.DVO]: (data, params) =>
    calculateDVOIndicator(data, params.maPeriod, params.rankPeriod),
  [INDICATOR_TYPE.KRI]: (data, params) => calculateKRIIndicator(data, params.period),
  [INDICATOR_TYPE.VZO]: (data, params) => calculateVZOIndicator(data, params.period),
  [INDICATOR_TYPE.VORTEX]: (data, params) => calculateVortexIndicator(data, params.period),
  [INDICATOR_TYPE.PPO]: (data, params) => calculatePPOIndicator(data, params.fast, params.slow),
  [INDICATOR_TYPE.TRIX]: (data, params) => calculateTRIXIndicator(data, params.period),
  [INDICATOR_TYPE.STOCH_RSI]: (data, params) =>
    calculateStochRSIIndicator(data, params.rsiPeriod, params.stochPeriod, params.smoothK),
  [INDICATOR_TYPE.VOLUME_OSC]: (data, params) =>
    calculateVolumeOscillatorIndicator(data, params.short, params.long),
  [INDICATOR_TYPE.CHAIKIN_OSC]: (data, params) =>
    calculateChaikinOscillatorIndicator(data, params.fast, params.slow),
  [INDICATOR_TYPE.EOM]: (data, params) => calculateEOMIndicator(data, params.period),
  [INDICATOR_TYPE.HIST_VOL]: (data, params) =>
    calculateHistoricalVolatilityIndicator(data, params.period, params.annualization),
  [INDICATOR_TYPE.AROON_OSC]: (data, params) =>
    calculateAroonOscillatorIndicator(data, params.period),
  [INDICATOR_TYPE.ATR]: (data, params) => calculateATR(data, params.period),
  [INDICATOR_TYPE.OBV]: (data) => calculateOBV(data),
  [INDICATOR_TYPE.MFI]: (data, params) => calculateMFI(data, params.period),
  [INDICATOR_TYPE.PVT]: (data) => calculatePVT(data),
  [INDICATOR_TYPE.NVI]: (data) => calculateNVI(data),
  [INDICATOR_TYPE.CMF]: (data, params) => calculateCMF(data, params.period),
  [INDICATOR_TYPE.AD_LINE]: (data) => calculateADLine(data),
};

const BAND_CALCULATORS: Record<BandIndicatorType, BandCalculator> = {
  [INDICATOR_TYPE.BOLLINGER_BANDS]: (data, params) =>
    calculateBollingerBands(data, params.period, params.stdDev),
  [INDICATOR_TYPE.KELTNER_CHANNELS]: (data, params) =>
    calculateKeltnerChannels(data, params.period, params.multiplier),
  [INDICATOR_TYPE.DONCHIAN_CHANNELS]: (data, params) =>
    calculateDonchianChannels(data, params.period),
};

const INDICATOR_TYPE_IDS = new Set<string>(Object.values(INDICATOR_TYPE));

const isIndicatorType = (id: string): id is IndicatorType => INDICATOR_TYPE_IDS.has(id);

const isBandIndicatorType = (id: IndicatorType): id is BandIndicatorType =>
  id === INDICATOR_TYPE.BOLLINGER_BANDS ||
  id === INDICATOR_TYPE.KELTNER_CHANNELS ||
  id === INDICATOR_TYPE.DONCHIAN_CHANNELS;

const isCompleteRegistry = (
  registry: object,
): registry is Record<IndicatorType, IndicatorDefinition> =>
  Object.values(INDICATOR_TYPE).every((id) => Object.hasOwn(registry, id));

const buildRegistry = (): Record<IndicatorType, IndicatorDefinition> => {
  const entries: [IndicatorType, IndicatorDefinition][] = [];
  for (const catalog of AVAILABLE_INDICATORS) {
    if (!isIndicatorType(catalog.id)) {
      throw new Error(`Unknown indicator id "${catalog.id}" in catalog`);
    }
    const id = catalog.id;
    if (isBandIndicatorType(id)) {
      if (catalog.output !== INDICATOR_OUTPUT.BAND) {
        throw new Error(`Indicator "${id}" is registered as band but catalog output is not band`);
      }
      entries.push([
        id,
        { id, output: INDICATOR_OUTPUT.BAND, catalog, calculate: BAND_CALCULATORS[id] },
      ]);
      continue;
    }
    if (catalog.output === INDICATOR_OUTPUT.BAND) {
      throw new Error(`Indicator "${id}" has band catalog output but no band calculator`);
    }
    entries.push([id, { id, output: catalog.output, catalog, calculate: LINE_CALCULATORS[id] }]);
  }
  const registry = Object.fromEntries(entries);
  if (!isCompleteRegistry(registry)) {
    throw new Error("Indicator registry is missing entries");
  }
  return registry;
};

export const INDICATOR_REGISTRY: Record<IndicatorType, IndicatorDefinition> = buildRegistry();

export const INDICATOR_REGISTRY_BY_ID: ReadonlyMap<string, IndicatorDefinition> = new Map(
  Object.entries(INDICATOR_REGISTRY),
);
