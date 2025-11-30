/** Application Layer - Dependency injection composition */

import { Layer } from "effect";
import { HttpClientLive } from "../http/client";
import { AppConfigLive } from "../config/app.config";
import {
  CoinGeckoServiceLive,
  GlobalMarketServiceLive,
  CoinGeckoChartServiceLive,
} from "../data-sources/coingecko";
import { BinanceServiceLive } from "../data-sources/binance";
import { HeatmapServiceLive } from "../data-sources/heatmap";
import { DefiLlamaServiceLive } from "../data-sources/defillama";
import { AggregatedDataServiceLive } from "../data-sources/aggregator";
import { AnalysisServiceLive } from "../../services/analysis";
import { BuybackServiceLive } from "../../services/buyback";
import { ChartDataServiceLive } from "../data-sources/binance/chart.provider";
import { DevLoggerLive } from "../logging/logger";

// Core: logging + config
const CoreLayer = Layer.mergeAll(DevLoggerLive, AppConfigLive);

// HTTP client
const HttpLayer = HttpClientLive;

// Chart data (depends on HTTP)
const ChartLayer = ChartDataServiceLive.pipe(Layer.provide(HttpLayer));

// Infrastructure
const InfraLayer = Layer.mergeAll(HttpLayer, ChartLayer).pipe(Layer.provide(CoreLayer));

// Data providers
const CoinGeckoLayer = CoinGeckoServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const GlobalMarketLayer = GlobalMarketServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const CoinGeckoChartLayer = CoinGeckoChartServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const BinanceLayer = BinanceServiceLive.pipe(Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer)));

const DefiLlamaLayer = DefiLlamaServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const HeatmapLayer = HeatmapServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer))
);

// Aggregated data
const AggregatedDataLayer = AggregatedDataServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer, BinanceLayer, HeatmapLayer))
);

// Services
const AnalysisLayer = AnalysisServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer))
);

const BuybackLayer = BuybackServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer, DefiLlamaLayer))
);

// Combined app layer
export const AppLayer = Layer.mergeAll(
  CoreLayer,
  InfraLayer,
  CoinGeckoLayer,
  GlobalMarketLayer,
  CoinGeckoChartLayer,
  BinanceLayer,
  DefiLlamaLayer,
  HeatmapLayer,
  AggregatedDataLayer,
  AnalysisLayer,
  BuybackLayer
);

export type AppLayer = typeof AppLayer;
