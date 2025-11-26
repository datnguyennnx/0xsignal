/**
 * Data Sources Aggregator
 * Combines multiple data sources with optimized caching and request deduplication
 */

import { Effect, Context, Layer } from "effect";
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
import { CoinGeckoService } from "./coingecko";
import { BinanceService } from "./binance";
import { HeatmapService } from "./heatmap";
import { CacheService } from "../cache/memory.cache";
import { Logger } from "../logging/console.logger";
import { DataSourceError, type AdapterInfo } from "./types";

// ============================================================================
// Aggregated Data Service Interface
// ============================================================================

export interface AggregatedDataService {
  // Spot prices (CoinGecko)
  readonly getPrice: (symbol: string) => Effect.Effect<CryptoPrice, DataSourceError>;
  readonly getTopCryptos: (limit?: number) => Effect.Effect<CryptoPrice[], DataSourceError>;

  // Liquidations (Binance)
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

  // Derivatives (Binance)
  readonly getOpenInterest: (symbol: string) => Effect.Effect<OpenInterestData, DataSourceError>;
  readonly getFundingRate: (symbol: string) => Effect.Effect<FundingRateData, DataSourceError>;
  readonly getTopOpenInterest: (
    limit?: number
  ) => Effect.Effect<OpenInterestData[], DataSourceError>;

  // Heatmap
  readonly getMarketHeatmap: (
    config: HeatmapConfig
  ) => Effect.Effect<MarketHeatmap, DataSourceError>;

  // Metadata
  readonly getSources: () => readonly AdapterInfo[];
}

export class AggregatedDataServiceTag extends Context.Tag("AggregatedDataService")<
  AggregatedDataServiceTag,
  AggregatedDataService
>() {}

// ============================================================================
// Cache Configuration
// ============================================================================

const cacheKeys = {
  price: (symbol: string) => `ds-price-${symbol}`,
  topCryptos: (limit: number) => `ds-top-${limit}`,
  liquidations: (symbol: string, tf: string) => `ds-liq-${symbol}-${tf}`,
  liquidationHeatmap: (symbol: string) => `ds-liq-heatmap-${symbol}`,
  marketLiquidations: () => "ds-market-liq",
  openInterest: (symbol: string) => `ds-oi-${symbol}`,
  fundingRate: (symbol: string) => `ds-fr-${symbol}`,
  topOpenInterest: (limit: number) => `ds-top-oi-${limit}`,
  heatmap: (config: HeatmapConfig) =>
    `ds-heatmap-${config.metric}-${config.limit}-${config.category || "all"}`,
};

const TTL = {
  price: 30_000,
  topCryptos: 60_000,
  liquidations: 60_000,
  openInterest: 120_000,
  fundingRate: 300_000,
  heatmap: 60_000,
};

// ============================================================================
// Aggregated Data Service Implementation
// ============================================================================

export const AggregatedDataServiceLive = Layer.effect(
  AggregatedDataServiceTag,
  Effect.gen(function* () {
    const coinGecko = yield* CoinGeckoService;
    const binance = yield* BinanceService;
    const heatmap = yield* HeatmapService;
    const cache = yield* CacheService;
    const logger = yield* Logger;

    // Spot prices (CoinGecko) - using getOrFetch for deduplication
    const getPrice = (symbol: string) =>
      cache.getOrFetch(cacheKeys.price(symbol), coinGecko.getPrice(symbol), TTL.price);

    const getTopCryptos = (limit = 100) =>
      cache.getOrFetch(cacheKeys.topCryptos(limit), coinGecko.getTopCryptos(limit), TTL.topCryptos);

    // Liquidations (Binance)
    const getLiquidations = (symbol: string, timeframe: LiquidationTimeframe) =>
      cache.getOrFetch(
        cacheKeys.liquidations(symbol, timeframe),
        binance.getLiquidations(symbol, timeframe),
        TTL.liquidations
      );

    const getLiquidationHeatmap = (symbol: string) =>
      cache.getOrFetch(
        cacheKeys.liquidationHeatmap(symbol),
        binance.getLiquidationHeatmap(symbol),
        TTL.liquidations
      );

    const getMarketLiquidationSummary = () =>
      cache.getOrFetch(
        cacheKeys.marketLiquidations(),
        binance.getMarketLiquidationSummary(),
        TTL.liquidations
      );

    // Derivatives (Binance)
    const getOpenInterest = (symbol: string) =>
      cache.getOrFetch(
        cacheKeys.openInterest(symbol),
        binance.getOpenInterest(symbol),
        TTL.openInterest
      );

    const getFundingRate = (symbol: string) =>
      cache.getOrFetch(
        cacheKeys.fundingRate(symbol),
        binance.getFundingRate(symbol),
        TTL.fundingRate
      );

    const getTopOpenInterest = (limit = 20) =>
      cache.getOrFetch(
        cacheKeys.topOpenInterest(limit),
        binance.getTopOpenInterest(limit),
        TTL.openInterest
      );

    // Heatmap
    const getMarketHeatmap = (config: HeatmapConfig) =>
      cache.getOrFetch(cacheKeys.heatmap(config), heatmap.getMarketHeatmap(config), TTL.heatmap);

    // Metadata
    const getSources = (): readonly AdapterInfo[] => [coinGecko.info, binance.info, heatmap.info];

    return {
      getPrice,
      getTopCryptos,
      getLiquidations,
      getLiquidationHeatmap,
      getMarketLiquidationSummary,
      getOpenInterest,
      getFundingRate,
      getTopOpenInterest,
      getMarketHeatmap,
      getSources,
    };
  })
);
