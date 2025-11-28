/**
 * Application Layer
 * Composes all infrastructure layers with Effect-native logging
 *
 * Each service uses Effect's Cache.make internally for proper concurrent handling:
 * - Concurrent lookups for same key only compute once
 * - TTL-based expiration
 * - Automatic request deduplication
 */

import { Layer } from "effect";
import { HttpClientLive } from "../http/client";
import { CoinGeckoServiceLive } from "../data-sources/coingecko";
import { BinanceServiceLive } from "../data-sources/binance";
import { HeatmapServiceLive } from "../data-sources/heatmap";
import { DefiLlamaServiceLive } from "../data-sources/defillama";
import { AggregatedDataServiceLive } from "../data-sources/aggregator";
import { AnalysisServiceLive } from "../../services/analysis";
import { BuybackServiceLive } from "../../services/buyback";
import { ChartDataServiceLive } from "../data-sources/binance/chart.provider";
import { DevLoggerLive } from "../logging/logger";

// Core: Effect-native pretty logging
const CoreLayer = DevLoggerLive;

// Infrastructure: HTTP client with request deduplication
const InfraLayer = Layer.mergeAll(HttpClientLive, ChartDataServiceLive).pipe(
  Layer.provide(CoreLayer)
);

// Data providers - each has internal caching with Effect's Cache.make
const CoinGeckoLayer = CoinGeckoServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const BinanceLayer = BinanceServiceLive.pipe(Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer)));

const DefiLlamaLayer = DefiLlamaServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

// Heatmap depends on CoinGecko (uses CoinGecko's cache)
const HeatmapLayer = HeatmapServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer))
);

// Aggregated data combines all providers (delegates to their caches)
const AggregatedDataLayer = AggregatedDataServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer, BinanceLayer, HeatmapLayer))
);

// Analysis depends on CoinGecko (has own cache + uses CoinGecko's cache)
const AnalysisLayer = AnalysisServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer))
);

// Buyback depends on DefiLlama and CoinGecko (has own cache + uses their caches)
const BuybackLayer = BuybackServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer, DefiLlamaLayer))
);

// Combined app layer - all services with proper caching
export const AppLayer = Layer.mergeAll(
  CoreLayer,
  InfraLayer,
  CoinGeckoLayer,
  BinanceLayer,
  DefiLlamaLayer,
  HeatmapLayer,
  AggregatedDataLayer,
  AnalysisLayer,
  BuybackLayer
);
