/** Application Layer - Dependency injection composition */

import { Layer } from "effect";
import { DevLoggerLive } from "../logging/logger";
import { FetchHttpClient } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { makeMarketDataLayer } from "./market-data.layer";
import { HealthServicesLive } from "./health.layer";

const Core = Layer.mergeAll(DevLoggerLive, BunContext.layer, FetchHttpClient.layer);
export const AppLayer = Layer.mergeAll(Core, makeMarketDataLayer(), HealthServicesLive);
