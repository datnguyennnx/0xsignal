/** Data Sources Aggregator - Combines multiple providers */

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
import { DataSourceError, type AdapterInfo } from "./types";

export interface AggregatedDataService {
  readonly getPrice: (symbol: string) => Effect.Effect<CryptoPrice, DataSourceError>;
  readonly getTopCryptos: (limit?: number) => Effect.Effect<CryptoPrice[], DataSourceError>;
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
  readonly getOpenInterest: (symbol: string) => Effect.Effect<OpenInterestData, DataSourceError>;
  readonly getFundingRate: (symbol: string) => Effect.Effect<FundingRateData, DataSourceError>;
  readonly getTopOpenInterest: (
    limit?: number
  ) => Effect.Effect<OpenInterestData[], DataSourceError>;
  readonly getMarketHeatmap: (
    config: HeatmapConfig
  ) => Effect.Effect<MarketHeatmap, DataSourceError>;
  readonly getSources: () => readonly AdapterInfo[];
}

export class AggregatedDataServiceTag extends Context.Tag("AggregatedDataService")<
  AggregatedDataServiceTag,
  AggregatedDataService
>() {}

export const AggregatedDataServiceLive = Layer.effect(
  AggregatedDataServiceTag,
  Effect.gen(function* () {
    const coinGecko = yield* CoinGeckoService;
    const binance = yield* BinanceService;
    const heatmap = yield* HeatmapService;

    return {
      // Spot (CoinGecko)
      getPrice: (symbol) => coinGecko.getPrice(symbol),
      getTopCryptos: (limit = 100) => coinGecko.getTopCryptos(limit),

      // Liquidations (Binance)
      getLiquidations: (symbol, timeframe) => binance.getLiquidations(symbol, timeframe),
      getLiquidationHeatmap: (symbol) => binance.getLiquidationHeatmap(symbol),
      getMarketLiquidationSummary: () => binance.getMarketLiquidationSummary(),

      // Derivatives (Binance)
      getOpenInterest: (symbol) => binance.getOpenInterest(symbol),
      getFundingRate: (symbol) => binance.getFundingRate(symbol),
      getTopOpenInterest: (limit = 20) => binance.getTopOpenInterest(limit),

      // Heatmap
      getMarketHeatmap: (config) => heatmap.getMarketHeatmap(config),

      // Metadata
      getSources: () => [coinGecko.info, binance.info, heatmap.info] as const,
    };
  })
);
