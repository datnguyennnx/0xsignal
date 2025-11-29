/** Data Source Types - Provider abstractions */

import { Data, Effect } from "effect";
import type {
  CryptoPrice,
  LiquidationData,
  LiquidationHeatmap,
  MarketLiquidationSummary,
  LiquidationTimeframe,
  OpenInterestData,
  FundingRateData,
  MarketHeatmap,
  HeatmapConfig,
} from "@0xsignal/shared";

// Errors
export class DataSourceError extends Data.TaggedError("DataSourceError")<{
  readonly source: string;
  readonly message: string;
  readonly symbol?: string;
  readonly cause?: unknown;
}> {}

export class RateLimitError extends Data.TaggedError("RateLimitError")<{
  readonly source: string;
  readonly retryAfter?: number;
}> {}

export class DataNotAvailableError extends Data.TaggedError("DataNotAvailableError")<{
  readonly source: string;
  readonly dataType: string;
  readonly symbol?: string;
}> {}

// Adapter metadata
export interface AdapterCapabilities {
  readonly spotPrices: boolean;
  readonly futuresPrices: boolean;
  readonly liquidations: boolean;
  readonly openInterest: boolean;
  readonly fundingRates: boolean;
  readonly heatmap: boolean;
  readonly historicalData: boolean;
  readonly realtime: boolean;
}

export interface AdapterInfo {
  readonly name: string;
  readonly version: string;
  readonly capabilities: AdapterCapabilities;
  readonly rateLimit: { readonly requestsPerMinute: number; readonly requestsPerSecond?: number };
}

// Provider interfaces
export interface SpotPriceProvider {
  readonly info: AdapterInfo;
  readonly getPrice: (symbol: string) => Effect.Effect<CryptoPrice, DataSourceError>;
  readonly getTopCryptos: (limit?: number) => Effect.Effect<CryptoPrice[], DataSourceError>;
}

export interface LiquidationProvider {
  readonly info: AdapterInfo;
  readonly getLiquidations: (
    symbol: string,
    timeframe: LiquidationTimeframe
  ) => Effect.Effect<LiquidationData, DataSourceError>;
  readonly getLiquidationHeatmap: (
    symbol: string
  ) => Effect.Effect<LiquidationHeatmap, DataSourceError>;
  readonly getMarketLiquidationSummary: () => Effect.Effect<
    MarketLiquidationSummary,
    DataSourceError
  >;
}

export interface DerivativesProvider {
  readonly info: AdapterInfo;
  readonly getOpenInterest: (symbol: string) => Effect.Effect<OpenInterestData, DataSourceError>;
  readonly getFundingRate: (symbol: string) => Effect.Effect<FundingRateData, DataSourceError>;
  readonly getTopOpenInterest: (
    limit?: number
  ) => Effect.Effect<OpenInterestData[], DataSourceError>;
}

export interface HeatmapProvider {
  readonly info: AdapterInfo;
  readonly getMarketHeatmap: (
    config: HeatmapConfig
  ) => Effect.Effect<MarketHeatmap, DataSourceError>;
}
