// Chart types
export type { ChartDataPoint } from "./types/chart";

// Market symbol normalization
export {
  parseSymbol,
  normalizeSymbol,
  type AssetKind,
  type NormalizedAsset,
} from "./utils/market-symbol";

// Candle normalizer
export { normalizeCandle, normalizeChartDataPoints } from "./utils/normalizeCandle";

// Indicator types
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

// Indicator config utilities
export {
  AVAILABLE_INDICATORS,
  getIndicatorBaseId,
  getIndicatorConfigById,
  normalizeIndicatorParams,
  createIndicatorInstanceId,
} from "./indicators/config";

// Indicator dispatcher
export {
  calculateLineIndicator,
  calculateBandIndicator,
  isBandIndicator,
  isHistogramIndicator,
  LINE_INDICATOR_MAP,
  BAND_INDICATOR_MAP,
} from "./indicators/dispatcher";

// Indicator metadata
export { BAND_INDICATOR_IDS, HISTOGRAM_INDICATOR_IDS } from "./indicators/metadata";

// ─── API Boundary Schemas (pure TypeScript types, no runtime deps) ────────────
export type { ApiEnvelope } from "./schemas/envelope";
export type { ApiErrorBody } from "./schemas/errors";
export type {
  Candle,
  MarketTicker,
  OrderBookLevel,
  OrderBook,
  TradeAnnotation,
  MarketTypeCategory,
  AggregatedMarket,
  CoverageWindow,
  CoverageResult,
  CandleResponse,
  RecentCandleResponse,
  HealthStatus,
} from "./schemas/market-data";
export type {
  ClearinghouseState,
  SpotClearinghouseState,
  OpenOrder,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
} from "./schemas/user-data";
export type {
  PlaceOrderRequest,
  UpdateLeverageRequest,
  CancelOrdersRequest,
} from "./schemas/exchange";
