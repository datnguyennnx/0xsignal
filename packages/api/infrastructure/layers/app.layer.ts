import { Layer } from "effect";
import { devLoggerLayer } from "../logging/logger";
import { FetchHttpClient } from "effect/unstable/http";
import { BunServices } from "@effect/platform-bun";
import { marketDataInfrastructureLayer } from "./market-data.layer";
import { healthServiceLayer } from "./health.layer";
import { applicationServiceLayer } from "./services.layer";
import { authLayer, AuthInfraLayer, MigrationLayer } from "@0xsignal/auth";
import { postgresConnectionPoolLayer } from "../db/postgres/client";
import { hyperliquidClientLayer } from "../data-sources/hyperliquid/client";
import { CorsServiceLayer } from "../../presentation/http/cors";

const Core = Layer.mergeAll(
  devLoggerLayer,
  BunServices.layer,
  FetchHttpClient.layer,
  CorsServiceLayer
);
const Infrastructure = Layer.mergeAll(
  marketDataInfrastructureLayer,
  healthServiceLayer,
  MigrationLayer
).pipe(Layer.provideMerge(hyperliquidClientLayer), Layer.provideMerge(postgresConnectionPoolLayer));

const AppServices = Layer.mergeAll(applicationServiceLayer, authLayer).pipe(
  Layer.provideMerge(AuthInfraLayer)
);

export const AppLayer: Layer.Layer<any, any, never> = AppServices.pipe(
  Layer.provideMerge(Infrastructure),
  Layer.provideMerge(Core)
);
