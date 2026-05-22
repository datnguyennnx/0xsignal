/**
 * Shared boundary types — single source of truth for API contracts.
 *
 * Import types via `import type { ... } from "@0xsignal/shared/schemas/..."`.
 */

export type { ApiEnvelope } from "./envelope";
export type { ApiErrorBody } from "./errors";

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
} from "./market-data";

export type {
  LeverageIsolated,
  LeverageCross,
  LeverageInfo,
  AssetPosition,
  ClearinghouseState,
  SpotBalance,
  SpotClearinghouseState,
  OpenOrder,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
} from "./user-data";

export type {
  OrderSide,
  OrderType,
  PlaceOrderEntry,
  PlaceOrderRequest,
  UpdateLeverageRequest,
  CancelEntry,
  CancelOrdersRequest,
} from "./exchange";
