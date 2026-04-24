import { Layer } from "effect";
import { DevLoggerLive } from "../logging/logger";
import { FetchHttpClient } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { MarketDataPortsLive } from "./market-data.layer";
import { HealthServicesLive } from "./health.layer";
import { RepositoriesLive } from "./repositories.layer";
import { AppServicesLive } from "./services.layer";
import { EngineLive } from "./engine.layer";

import { HyperliquidClientLive } from "../data-sources/hyperliquid/client";

const Core = Layer.mergeAll(DevLoggerLive, BunContext.layer, FetchHttpClient.layer);
const Infrastructure = Layer.mergeAll(
  MarketDataPortsLive,
  HealthServicesLive,
  RepositoriesLive,
  EngineLive,
  HyperliquidClientLive
);

export const AppLayer = AppServicesLive.pipe(
  Layer.provideMerge(Infrastructure),
  Layer.provideMerge(Core)
);
