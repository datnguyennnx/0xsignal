/** Application Layer - Dependency injection composition */

import { Layer } from "effect";
import { HttpClientLive } from "../http/client";
import { RateLimiterLive } from "../http/rate-limiter";
import { AppConfigLive } from "../config/app.config";
import { CoinGeckoServiceLive, GlobalMarketServiceLive } from "../data-sources/coingecko";
import { AggregatedDataServiceLive } from "../data-sources/aggregator";
import { DevLoggerLive } from "../logging/logger";

const CoreLayer = Layer.mergeAll(DevLoggerLive, AppConfigLive);

const HttpLayer = Layer.mergeAll(HttpClientLive, RateLimiterLive).pipe(Layer.provide(CoreLayer));

const CoinGeckoLayer = CoinGeckoServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, HttpLayer))
);

const InfraLayer = HttpLayer;

const GlobalMarketLayer = GlobalMarketServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const AggregatedDataLayer = AggregatedDataServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer))
);

export const AppLayer = Layer.mergeAll(
  CoreLayer,
  InfraLayer,
  CoinGeckoLayer,
  GlobalMarketLayer,
  AggregatedDataLayer
);

export type AppLayer = typeof AppLayer;
