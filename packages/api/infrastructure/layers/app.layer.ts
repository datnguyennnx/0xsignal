import { Layer } from "effect";
import { devLoggerLayer } from "../logging/logger";
import { FetchHttpClient } from "effect/unstable/http";
import { BunServices } from "@effect/platform-bun";
import { CorsServiceLayer } from "../../presentation/http/cors";

// Infrastructure layers
import { marketCandleStoreLayer } from "./market-candle-store.layer";
import { marketRemoteProviderLayer } from "./market-remote-provider.layer";
import { healthServiceLayer } from "./health-service.layer";
import { postgresConnectionPoolLayer } from "../db/postgres/client";
import { hyperliquidClientLayer } from "../data-sources/hyperliquid/client";

// Application service layers (inlined from services.layer.ts)
import { marketDataServiceLayer } from "../../application/market-data/service";
import { userDataServiceLayer } from "../../application/user-data/service";
import { exchangeServiceLayer } from "../../application/exchange/service";

// Stream layers
import { MarketStreamHubLayer } from "../streams/hyperliquid/hub";

// External
import { authLayer, AuthInfraLayer, MigrationLayer } from "@0xsignal/auth";

const Core = Layer.mergeAll(
  devLoggerLayer,
  BunServices.layer,
  FetchHttpClient.layer,
  CorsServiceLayer,
);

// MarketStreamHubLayer requires HyperliquidProvider (from marketRemoteProviderLayer).
// Layer.provide resolves this dependency while keeping MarketStreamHub visible.
const ResolvedHubLayer = Layer.provide(MarketStreamHubLayer, marketRemoteProviderLayer);

const Infrastructure = Layer.mergeAll(
  marketCandleStoreLayer.pipe(Layer.provideMerge(marketRemoteProviderLayer)),
  ResolvedHubLayer,
  healthServiceLayer,
  MigrationLayer,
).pipe(Layer.provideMerge(hyperliquidClientLayer), Layer.provideMerge(postgresConnectionPoolLayer));

const AppServices = Layer.mergeAll(
  marketDataServiceLayer,
  userDataServiceLayer,
  exchangeServiceLayer,
  authLayer,
).pipe(Layer.provideMerge(AuthInfraLayer));

export const AppLayer = AppServices.pipe(
  Layer.provideMerge(Infrastructure),
  Layer.provideMerge(Core),
) as Layer.Layer<any, any, never>;
