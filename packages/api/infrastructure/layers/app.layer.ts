/** Application Layer - Dependency injection composition */

import { Layer } from "effect";
import { HttpClientLive } from "../http/client";
import { RateLimiterLive } from "../http/rate-limiter";
import { RequestCacheLayer } from "../cache/request-cache";
import { AppConfigLive } from "../config/app.config";
import {
  CoinGeckoServiceLive,
  GlobalMarketServiceLive,
  CoinGeckoChartServiceLive,
} from "../data-sources/coingecko";
import { AggregatedDataServiceLive } from "../data-sources/aggregator";
import { HyperliquidChartServiceLive } from "../data-sources/hyperliquid";
import { DevLoggerLive } from "../logging/logger";
import { AIServiceLive } from "../../services/ai-live";
import { ModelsRegistryLive } from "../../services/models-registry";

const CoreLayer = Layer.mergeAll(DevLoggerLive, AppConfigLive);

const HttpLayer = Layer.mergeAll(HttpClientLive, RateLimiterLive).pipe(Layer.provide(CoreLayer));

const CoinGeckoLayer = CoinGeckoServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, HttpLayer))
);

const HyperliquidChartLayer = HyperliquidChartServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, HttpLayer))
);

const InfraLayer = Layer.mergeAll(HttpLayer, HyperliquidChartLayer);

const GlobalMarketLayer = GlobalMarketServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const CoinGeckoChartLayer = CoinGeckoChartServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const AggregatedDataLayer = AggregatedDataServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer))
);

const AILayer = AIServiceLive.pipe(Layer.provide(CoreLayer));

const ModelsLayer = ModelsRegistryLive;

export const AppLayer = Layer.mergeAll(
  CoreLayer,
  InfraLayer,
  CoinGeckoLayer,
  GlobalMarketLayer,
  CoinGeckoChartLayer,
  AggregatedDataLayer,
  RequestCacheLayer,
  AILayer,
  ModelsLayer
);

export type AppLayer = typeof AppLayer;
