/**
 * @0xsignal/shared — Zero-dependency type-and-utility library.
 *
 * This package is the shared contract surface between frontend and backend.
 * All types in `schemas/` are pure TypeScript mirrors of Effect Schema definitions
 * in the owning backend packages. See ARCHITECTURE.md for the full pattern.
 */

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
export {
  normalizeCandle,
  normalizeChartDataPoints,
  candleToChartDataPoint,
} from "./utils/normalizeCandle";

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

// API Boundary Schemas
export type { ApiEnvelope } from "./schemas/envelope";
export type { ApiErrorBody } from "./schemas/errors";
export type {
  Candle,
  MarketTicker,
  OrderBook,
  MarketTypeCategory,
  AggregatedMarket,
  CoverageWindow,
  CoverageResult,
  CandleResponse,
  RecentCandleResponse,
  HealthStatus,
  WsMarketChannel,
  WsMarketInterval,
  WsMarketSubscription,
} from "./schemas/market-data";
export { WS_MARKET_INTERVALS } from "./schemas/market-data";
export type {
  ClearinghouseState,
  SpotClearinghouseState,
  OpenOrder,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
  PortfolioPeriod,
  PortfolioPeriodKey,
  PortfolioResponse,
  UserVaultEquity,
  UserFundingDelta,
  UserFundingEntry,
} from "./schemas/user-data";
export type {
  OrderSide,
  OrderType,
  PlaceOrderEntry,
  PlaceOrderRequest,
  UpdateLeverageRequest,
  CancelEntry,
  CancelOrdersRequest,
} from "./schemas/exchange";
export type { AuthMeResponse } from "./schemas/auth";
