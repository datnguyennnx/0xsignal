import { Layer } from "effect";
import {
  authLayer,
  AuthInfraLayer,
  AuthService,
  ExchangeAccountRepo,
  AgentRegistrationRepo,
  WalletChallengeRepo,
  type PostgresConnectionPool,
} from "@0xsignal/auth";
import type { HyperliquidClient } from "../integrations/hyperliquid/data-sources/client";
import type { HyperliquidRateLimiter } from "../integrations/hyperliquid/rate-limit";
import { OrderIntentService } from "../modules/exchange";
import { orderIntentLayer } from "../modules/exchange/layer";
import {
  MarketDataService,
  type MarketCandleStore,
  type MarketRemoteProvider,
} from "../modules/market-data";
import { marketDataServiceLayer } from "../modules/market-data/layer";
import { UserDataService } from "../modules/user-data";
import { userDataServiceLayer } from "../modules/user-data/layer";

// The merged layer's provided services are named by their public API so the
// declaration stays portable; requirements are the infra the auth layer needs.
export const AppServicesLayer: Layer.Layer<
  | AuthService
  | ExchangeAccountRepo
  | AgentRegistrationRepo
  | WalletChallengeRepo
  | MarketDataService
  | UserDataService
  | OrderIntentService,
  never,
  | HyperliquidClient
  | HyperliquidRateLimiter
  | MarketCandleStore
  | MarketRemoteProvider
  | PostgresConnectionPool
> = Layer.mergeAll(marketDataServiceLayer, userDataServiceLayer, orderIntentLayer, authLayer).pipe(
  Layer.provideMerge(AuthInfraLayer),
);
