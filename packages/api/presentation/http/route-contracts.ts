import type { Effect } from "effect";
import { ExchangeAccountRepo, ExchangeCredentialRepo, type AuthService } from "@0xsignal/auth";
import { HealthService } from "../../application/health";
import { MarketDataService } from "../../application/market-data/contracts";
import { UserDataService } from "../../application/user-data/contracts";
import { ExchangeService } from "../../application/exchange/contracts";
import { CalendarService } from "../../application/calendar/contracts";
import { WhaleService } from "../../application/whales/contracts";
import type { CredentialVerifier } from "../../application/hyperliquid/credential-verification";
import type { HttpError } from "./error-response";

export { CredentialVerifier } from "../../application/hyperliquid/credential-verification";

export type UserDataHttpService = {
  readonly getClearinghouseState: (typeof UserDataService.Service)["getClearinghouseState"];
  readonly getSpotClearinghouseState: (typeof UserDataService.Service)["getSpotClearinghouseState"];
  readonly getOpenOrders: (typeof UserDataService.Service)["getOpenOrders"];
  readonly getFrontendOpenOrders: (typeof UserDataService.Service)["getFrontendOpenOrders"];
  readonly getMeta: (typeof UserDataService.Service)["getMeta"];
  readonly getHistoricalOrders: (typeof UserDataService.Service)["getHistoricalOrders"];
  readonly getUserFills: (typeof UserDataService.Service)["getUserFills"];
  readonly getPortfolio: (typeof UserDataService.Service)["getPortfolio"];
  readonly getUserVaultEquities: (typeof UserDataService.Service)["getUserVaultEquities"];
  readonly getUserFunding: (typeof UserDataService.Service)["getUserFunding"];
};

export type ExchangeHttpService = {
  readonly placeOrder: (typeof ExchangeService.Service)["placeOrder"];
  readonly updateLeverageAndMargin: (typeof ExchangeService.Service)["updateLeverageAndMargin"];
  readonly cancelOrders: (typeof ExchangeService.Service)["cancelOrders"];
};

export type MarketDataHttpService = {
  readonly discoverMarkets: (typeof MarketDataService.Service)["discoverMarkets"];
  readonly getCandles: (typeof MarketDataService.Service)["getCandles"];
  readonly getRecentCandles: (typeof MarketDataService.Service)["getRecentCandles"];
  readonly getTicker: (typeof MarketDataService.Service)["getTicker"];
  readonly getOrderBook: (typeof MarketDataService.Service)["getOrderBook"];
  readonly getTradeAnnotation: (typeof MarketDataService.Service)["getTradeAnnotation"];
};

export type CalendarHttpService = {
  readonly query: (typeof CalendarService.Service)["query"];
  readonly upcoming: (typeof CalendarService.Service)["upcoming"];
};

export type WhaleHttpService = {
  readonly queryPositions: (typeof WhaleService.Service)["queryPositions"];
};

export type HealthHttpService = {
  readonly check: (typeof HealthService.Service)["check"];
};

/**
 * Services the route handlers may depend on; the server runtime supplies all
 * of them through AppLayer, so handlers declare them instead of asserting.
 */
export type RouteEnvironment =
  | AuthService
  | ExchangeAccountRepo
  | ExchangeCredentialRepo
  | CredentialVerifier;

export type RouteHandler = (
  request: Request,
  url: URL,
  marketData: MarketDataHttpService,
  health: HealthHttpService,
  userData: UserDataHttpService,
  exchange: ExchangeHttpService,
  calendar: CalendarHttpService | undefined,
  whale: WhaleHttpService | undefined,
  userId?: string,
) => Effect.Effect<Response, HttpError, RouteEnvironment>;

/** Services a request effect resolves from the shared runtime. */
export type HttpRequestServices =
  | RouteEnvironment
  | HealthService
  | MarketDataService
  | UserDataService
  | ExchangeService;

/** A route handler whose services were already resolved by its wrapper. */
export type AuthRouteHandler = (
  request: Request,
  url: URL,
  marketData: MarketDataHttpService,
  health: HealthHttpService,
  userData: UserDataHttpService,
  exchange: ExchangeHttpService,
  calendar: CalendarHttpService | undefined,
  whale: WhaleHttpService | undefined,
  userId?: string,
) => Effect.Effect<Response, HttpError>;

/** A wallet/key route handler: credentials arrive as parameters, not services. */
export type CredentialHttpHandler = (
  request: Request,
  url: URL,
  accountRepo: typeof ExchangeAccountRepo.Service,
  credentialRepo: typeof ExchangeCredentialRepo.Service,
  verifier: typeof CredentialVerifier.Service,
  userId?: string,
) => Effect.Effect<Response, HttpError>;
