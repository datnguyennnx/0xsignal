/** Application Layer - Dependency injection composition */

import { Layer } from "effect";
import { HttpClientLive } from "../http/client";
import { RateLimiterLive } from "../http/rate-limiter";
import { AppConfigLive } from "../config/app.config";
import { DevLoggerLive } from "../logging/logger";
import { FetchHttpClient } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { makeMarketDataLayer } from "./market-data.layer";
import { HealthServicesLive } from "./health.layer";

const Core = Layer.mergeAll(DevLoggerLive, AppConfigLive, BunContext.layer, FetchHttpClient.layer);
const Http = Layer.mergeAll(HttpClientLive, RateLimiterLive).pipe(Layer.provide(Core));
export const AppLayer = Layer.mergeAll(Core, Http, makeMarketDataLayer(), HealthServicesLive);

export type AppLayer = typeof AppLayer;
