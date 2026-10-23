import { Layer } from "effect";
import {
  authLayer,
  AuthInfraLayer,
  AuthService,
  ExchangeAccountRepo,
  ExchangeCredentialRepo,
  type PostgresConnectionPool,
} from "@0xsignal/auth";
import { marketDataServiceLayer } from "../../application/market-data/service";
import { userDataServiceLayer } from "../../application/user-data/service";
import { exchangeServiceLayer } from "../../application/exchange/service";
import {
  MarketDataService,
  type MarketCandleStore,
  type MarketRemoteProvider,
} from "../../application/market-data/contracts";
import { UserDataService } from "../../application/user-data/contracts";
import { ExchangeService } from "../../application/exchange/contracts";
import { exchangeCredentialsLayer } from "../data-sources/hyperliquid/exchange-credentials";
import type { HyperliquidClient } from "../data-sources/hyperliquid/client";

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
