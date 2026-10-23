import { Layer } from "effect";
import { MigrationLayer } from "@0xsignal/auth";
import { marketCandleStoreLayer } from "./market-candle-store.layer";
import { marketRemoteProviderLayer } from "./market-remote-provider.layer";
import { healthServiceLayer } from "./health-service.layer";
import { CalendarLayer } from "./calendar.layer";
import { WhaleLayer } from "./whale.layer";
import { postgresConnectionPoolLayer } from "../db/postgres/client";
import {
  credentialVerifierLayer,
  hyperliquidClientLayer,
} from "../data-sources/hyperliquid/client";
import { MarketStreamHubLayer } from "../streams/hyperliquid/hub";

// marketRemoteProviderLayer is provided once here so both MarketStreamHubLayer
// and marketCandleStoreLayer resolve MarketRemoteProvider from the same instance.
export const InfrastructureLayer = Layer.mergeAll(
  marketCandleStoreLayer,
  MarketStreamHubLayer,
  healthServiceLayer,
  credentialVerifierLayer,
  MigrationLayer,
  CalendarLayer,
  WhaleLayer,
).pipe(
  Layer.provideMerge(marketRemoteProviderLayer),
  Layer.provideMerge(hyperliquidClientLayer),
  Layer.provideMerge(postgresConnectionPoolLayer),
);
