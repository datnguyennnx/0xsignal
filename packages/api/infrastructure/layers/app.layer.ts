import { Layer } from "effect";
import { devLoggerLayer } from "../logging/logger";
import { FetchHttpClient } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { marketDataInfrastructureLayer } from "./market-data.layer";
import { healthServiceLayer } from "./health.layer";
import { applicationServiceLayer } from "./services.layer";
import { postgresConnectionPoolLayer } from "../db/postgres/client";
import { hyperliquidClientLayer } from "../data-sources/hyperliquid/client";

const Core = Layer.mergeAll(devLoggerLayer, BunContext.layer, FetchHttpClient.layer);
const Infrastructure = Layer.mergeAll(
  marketDataInfrastructureLayer,
  healthServiceLayer,
  hyperliquidClientLayer
).pipe(Layer.provideMerge(postgresConnectionPoolLayer));

export const AppLayer = applicationServiceLayer.pipe(
  Layer.provideMerge(Infrastructure),
  Layer.provideMerge(Core)
);
