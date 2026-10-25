import { Layer } from "effect";
import { MigrationLayer } from "@0xsignal/auth";
import { hyperliquidClientLayer } from "../integrations/hyperliquid/data-sources/client";
import { MarketStreamHubLayer } from "../integrations/hyperliquid/streams/hub";
import { layer as hyperliquidRateLimiterLayer } from "../integrations/hyperliquid/rate-limit";
import { CalendarLayer } from "../modules/calendar/layer";
import { healthServiceLayer } from "../modules/health/layer";
import { marketCandleStoreLayer, marketRemoteProviderLayer } from "../modules/market-data/layer";
import { WhaleLayer } from "../modules/whales/layer";
import { postgresConnectionPoolLayer } from "../platform/db/client";

// marketRemoteProviderLayer is provided once here so both MarketStreamHubLayer
// and marketCandleStoreLayer resolve MarketRemoteProvider from the same instance.
export const InfrastructureLayer = Layer.mergeAll(
  marketCandleStoreLayer,
  MarketStreamHubLayer,
  healthServiceLayer,
  MigrationLayer,
  CalendarLayer,
  WhaleLayer,
).pipe(
  Layer.provideMerge(marketRemoteProviderLayer),
  Layer.provideMerge(hyperliquidRateLimiterLayer),
  Layer.provideMerge(hyperliquidClientLayer),
  Layer.provideMerge(postgresConnectionPoolLayer),
);
