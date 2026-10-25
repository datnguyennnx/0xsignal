import { ExchangeAccountRepo, type AuthService } from "@0xsignal/auth";
import type { HyperliquidClient } from "../integrations/hyperliquid/data-sources/hyperliquid-client";
import type { OrderIntentService } from "../modules/exchange";
import type { HealthService } from "../modules/health";
import type { MarketDataService, MarketStreamHub } from "../modules/market-data";
import type { UserDataService } from "../modules/user-data";

/**
 * Services the route handlers may depend on; the server runtime supplies all
 * of them through AppLayer, so handlers declare them instead of asserting.
 */
export type RouteEnvironment = AuthService | ExchangeAccountRepo;

/** Services a request effect resolves from the shared runtime. */
export type HttpRequestServices =
  | RouteEnvironment
  | HealthService
  | MarketDataService
  | UserDataService
  | OrderIntentService;

/**
 * Everything an HTTP request effect may require. AppLayer provides all of it;
 * the type is named once here so the layer and its consumers agree without
 * widening assertions.
 */
export type RequestEnvironment = HttpRequestServices | HyperliquidClient | MarketStreamHub;
