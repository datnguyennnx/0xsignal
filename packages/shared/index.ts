// ============================================================================
// Shared Types - Used by both API and Frontend
// ============================================================================

// Chart types
export type { ChartDataPoint } from "./types/chart";

// Market symbol normalization
export {
  parseSymbol,
  normalizeSymbol,
  type AssetKind,
  type NormalizedAsset,
} from "./utils/market-symbol";

// Indicators
export type {
  IndicatorCategory,
  IndicatorOutputType,
  IndicatorParamControl,
  IndicatorParamDefinition,
  IndicatorUsageInfo,
  IndicatorConfig,
  ActiveIndicator,
  IndicatorDataPoint,
  BandIndicatorDataPoint,
} from "./indicators/types";
export {
  AVAILABLE_INDICATORS,
  getIndicatorBaseId,
  getIndicatorConfigById,
  normalizeIndicatorParams,
  createIndicatorInstanceId,
} from "./indicators/config";
export {
  calculateSMA,
  calculateEMA,
  calculateWMAIndicator,
  calculateHMAIndicator,
  calculateRSI,
  calculateMACDLine,
  calculateBollingerBands,
  calculateATR,
  calculateDonchianChannels,
  calculateVWAP,
  calculateOBV,
  calculateStochasticK,
  calculateWilliamsR,
  calculateAO,
  calculateCCI,
  calculateROC,
  calculateMomentum,
  calculateTSI,
  calculateMFI,
  calculateCMF,
  calculateADLine,
  calculateZScoreIndicator,
  calculateStdDevIndicator,
  calculateLinRegSlopeIndicator,
  calculateATRPIndicator,
  calculateChoppinessIndicator,
  calculateEfficiencyRatioIndicator,
  calculateSuperTrend,
  calculateParabolicSAR,
  calculateADX,
} from "./indicators/calculations";
export {
  calculateLineIndicator,
  calculateBandIndicator,
  isBandIndicator,
  isHistogramIndicator,
} from "./indicators/dispatcher";
export { BAND_INDICATOR_IDS, HISTOGRAM_INDICATOR_IDS } from "./indicators/metadata";

// Patterns
export type { TradingSignal, PatternAnalysis, PatternName, PatternConfig } from "./patterns/types";
export { analyzeICT, type ICTAnalysis, type ICTConfig, DEFAULT_ICT_CONFIG } from "./patterns/ict";
export {
  analyzeWyckoff,
  type WyckoffAnalysis,
  type WyckoffConfig,
  DEFAULT_WYCKOFF_CONFIG,
} from "./patterns/wyckoff";
