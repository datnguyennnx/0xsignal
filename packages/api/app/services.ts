import { Layer } from "effect";
import {
  authLayer,
  AuthInfraLayer,
  AuthService,
  ExchangeAccountRepo,
  ExchangeCredentialRepo,
  type PostgresConnectionPool,
} from "@0xsignal/auth";
import { exchangeCredentialsLayer } from "../integrations/hyperliquid/data-sources/exchange-credentials";
import type { HyperliquidClient } from "../integrations/hyperliquid/data-sources/client";
import { ExchangeService } from "../modules/exchange";
import { exchangeServiceLayer } from "../modules/exchange/service";
import {
  MarketDataService,
  type MarketCandleStore,
  type MarketRemoteProvider,
} from "../modules/market-data";
import { marketDataServiceLayer } from "../modules/market-data/service";
import { UserDataService } from "../modules/user-data";
import { userDataServiceLayer } from "../modules/user-data/service";

// The merged layer's provided services are named by their public API so the
// declaration stays portable; requirements are the infra the auth layer needs.
export const AppServicesLayer: Layer.Layer<
  | AuthService
  | ExchangeAccountRepo
  | ExchangeCredentialRepo
  | MarketDataService
  | UserDataService
  | ExchangeService,
  never,
  HyperliquidClient | MarketCandleStore | MarketRemoteProvider | PostgresConnectionPool
> = Layer.mergeAll(
  marketDataServiceLayer,
  userDataServiceLayer,
  exchangeServiceLayer.pipe(Layer.provide(exchangeCredentialsLayer)),
  authLayer,
).pipe(Layer.provideMerge(AuthInfraLayer));
