/**
 * Application Layer
 * Composes all infrastructure layers
 */

import { Layer } from "effect";
import { HttpServiceLive } from "../data-sources/http.service";
import { CoinGeckoServiceLive } from "../data-sources/coingecko";
import { BinanceServiceLive } from "../data-sources/binance";
import { HeatmapServiceLive } from "../data-sources/heatmap";
import { AggregatedDataServiceLive } from "../data-sources/aggregator";
import { AnalysisServiceLive } from "../../services/analysis";
import { ChartDataServiceLive } from "../../application/stream-chart-data";
import { CacheServiceLive } from "../cache/memory.cache";
import { LoggerLiveDefault } from "../logging/console.logger";

// Core layer: logging
const CoreLayer = Layer.mergeAll(LoggerLiveDefault);

// Infrastructure layer: HTTP, cache, chart data
const InfraLayer = Layer.mergeAll(HttpServiceLive, CacheServiceLive, ChartDataServiceLive).pipe(
  Layer.provide(CoreLayer)
);

// Data providers layer
const CoinGeckoLayer = CoinGeckoServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const BinanceLayer = BinanceServiceLive.pipe(Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer)));

// Heatmap layer (depends on CoinGecko)
const HeatmapLayer = HeatmapServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer))
);

// Aggregated data layer (combines all providers)
const AggregatedDataLayer = AggregatedDataServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer, BinanceLayer, HeatmapLayer))
);

// Analysis layer
const AnalysisLayer = AnalysisServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer))
);

// Combined app layer
export const AppLayer = Layer.mergeAll(
  CoreLayer,
  InfraLayer,
  CoinGeckoLayer,
  BinanceLayer,
  HeatmapLayer,
  AggregatedDataLayer,
  AnalysisLayer
);
