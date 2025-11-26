/**
 * Data Sources Aggregator
 * Combines multiple data sources with caching
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

    const withCache = <T>(
      key: string,
      ttl: number,
      operation: Effect.Effect<T, DataSourceError>
    ): Effect.Effect<T, DataSourceError> =>
      cache.get<T>(key).pipe(
        Effect.tap((cached) => (cached ? logger.debug(`Cache hit: ${key}`) : Effect.void)),
        Effect.flatMap((cached) =>
          cached
            ? Effect.succeed(cached)
            : operation.pipe(Effect.tap((result) => cache.set(key, result, ttl)))
        )
      );

    // Spot prices (CoinGecko)
    const getPrice = (symbol: string) =>
      withCache(cacheKeys.price(symbol), TTL.price, coinGecko.getPrice(symbol));

    const getTopCryptos = (limit = 100) =>
      withCache(cacheKeys.topCryptos(limit), TTL.topCryptos, coinGecko.getTopCryptos(limit));

    // Liquidations (Binance)
    const getLiquidations = (symbol: string, timeframe: LiquidationTimeframe) =>
      withCache(
        cacheKeys.liquidations(symbol, timeframe),
        TTL.liquidations,
        binance.getLiquidations(symbol, timeframe)
      );

    const getLiquidationHeatmap = (symbol: string) =>
      withCache(
        cacheKeys.liquidationHeatmap(symbol),
        TTL.liquidations,
        binance.getLiquidationHeatmap(symbol)
      );

    const getMarketLiquidationSummary = () =>
      withCache(
        cacheKeys.marketLiquidations(),
        TTL.liquidations,
        binance.getMarketLiquidationSummary()
      );

    // Derivatives (Binance)
    const getOpenInterest = (symbol: string) =>
      withCache(cacheKeys.openInterest(symbol), TTL.openInterest, binance.getOpenInterest(symbol));

    const getFundingRate = (symbol: string) =>
      withCache(cacheKeys.fundingRate(symbol), TTL.fundingRate, binance.getFundingRate(symbol));

    const getTopOpenInterest = (limit = 20) =>
      withCache(
        cacheKeys.topOpenInterest(limit),
        TTL.openInterest,
        binance.getTopOpenInterest(limit)
      );

    // Heatmap
    const getMarketHeatmap = (config: HeatmapConfig) =>
      withCache(cacheKeys.heatmap(config), TTL.heatmap, heatmap.getMarketHeatmap(config));

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
