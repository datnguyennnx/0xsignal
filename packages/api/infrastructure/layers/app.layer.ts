/** Application Layer - Dependency injection composition */

import { Layer } from "effect";
import { HttpClientLive } from "../http/client";
import { RateLimiterLive } from "../http/rate-limiter";
import { AppConfigLive } from "../config/app.config";
import { CoinGeckoServiceLive, GlobalMarketServiceLive } from "../data-sources/coingecko";
import { AggregatedDataServiceLive } from "../data-sources/aggregator";
import { DevLoggerLive } from "../logging/logger";
import { FetchHttpClient } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";

const Core = Layer.mergeAll(DevLoggerLive, AppConfigLive, BunContext.layer, FetchHttpClient.layer);
const Http = Layer.mergeAll(HttpClientLive, RateLimiterLive).pipe(Layer.provide(Core));
const CoinGecko = CoinGeckoServiceLive.pipe(Layer.provide(Layer.mergeAll(Core, Http)));
const GlobalMarket = GlobalMarketServiceLive.pipe(Layer.provide(Layer.mergeAll(Core, Http)));
const Aggregator = AggregatedDataServiceLive.pipe(
  Layer.provide(Layer.mergeAll(Core, Http, CoinGecko))
);

export const AppLayer = Layer.mergeAll(Core, Http, CoinGecko, GlobalMarket, Aggregator).pipe(
  Layer.provide(Layer.mergeAll(Core, Http, CoinGecko))
);

export type AppLayer = typeof AppLayer;
