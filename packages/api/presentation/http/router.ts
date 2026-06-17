import { Effect } from "effect";
import { HealthService } from "../../application/health";
import { MarketDataService } from "../../application/market-data/contracts";
import { UserDataService } from "../../application/user-data/contracts";
import { ExchangeService } from "../../application/exchange/contracts";

import { healthRoute } from "./routes/health.routes";
import { buildMarketDataRoutes } from "./routes/market-data.routes";
import { buildUserDataRoutes } from "./routes/user-data.routes";
import { buildExchangeRoutes } from "./routes/exchange.routes";
import { buildCredentialRoutes } from "./routes/credentials.routes";
import {
  buildAuthRoutes,
  withAuth,
  ExchangeAccountRepo,
  ExchangeCredentialRepo,
} from "@0xsignal/auth";
import { mapServiceError } from "./error-response";

type HttpError = {
  readonly status: number;
  readonly message: string;
  readonly code?: string;
};

type UserDataHttpService = {
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

type ExchangeHttpService = {
  readonly placeOrder: (typeof ExchangeService.Service)["placeOrder"];
  readonly updateLeverageAndMargin: (typeof ExchangeService.Service)["updateLeverageAndMargin"];
  readonly cancelOrders: (typeof ExchangeService.Service)["cancelOrders"];
};

type MarketDataHttpService = {
  readonly discoverMarkets: (typeof MarketDataService.Service)["discoverMarkets"];
  readonly getCandles: (typeof MarketDataService.Service)["getCandles"];
  readonly getRecentCandles: (typeof MarketDataService.Service)["getRecentCandles"];
  readonly getTicker: (typeof MarketDataService.Service)["getTicker"];
  readonly getOrderBook: (typeof MarketDataService.Service)["getOrderBook"];
  readonly getTradeAnnotation: (typeof MarketDataService.Service)["getTradeAnnotation"];
};

type HealthHttpService = Parameters<typeof healthRoute>[0];

type RouteHandler = (
  request: Request,
  url: URL,
  marketData: MarketDataHttpService,
  health: HealthHttpService,
  userData: UserDataHttpService,
  exchange: ExchangeHttpService,
  userId?: string,
) => Effect.Effect<Response, HttpError, any>;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

// Auth routes handle their own errors internally; always returns a Response
const adaptAuthRoute =
  (
    handler: (
      request: Request,
    ) => Effect.Effect<Response, never, import("@0xsignal/auth").AuthService>,
  ): RouteHandler =>
  (request) =>
    handler(request).pipe(
      Effect.catchCause(() =>
        Effect.succeed(
          new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

// Requires a valid auth session before executing
const requireAuth =
  (routeHandler: RouteHandler): RouteHandler =>
  (request, url, marketData, health, userData, exchange) =>
    withAuth((session) =>
      routeHandler(request, url, marketData, health, userData, exchange, session.userId),
    )(request).pipe(
      Effect.catchCause(() =>
        Effect.succeed(
          new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

const matchPath = (pattern: string, path: string): boolean => {
  if (pattern === path) return true;

  if (pattern.includes(":")) {
    const regexStr = pattern.replace(/:([^/]+)/g, "([^/]+)");
    return new RegExp(`^${regexStr}$`).test(path);
  }

  return false;
};

const routes: Array<{ method: string; path: string; handler: RouteHandler }> = [
  {
    method: "GET",
    path: "/api/health",
    handler: (_request, _url, _marketData, health) =>
      healthRoute(health).pipe(Effect.map((body) => json({ data: body }))),
  },
  ...buildMarketDataRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: (request: Request, url: URL, marketData: MarketDataHttpService) =>
      route.handler(request, url, marketData),
  })),
  ...buildUserDataRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: (
      request: Request,
      url: URL,
      _marketData: MarketDataHttpService,
      _health: HealthHttpService,
      userData: UserDataHttpService,
    ) => route.handler(request, url, userData),
  })),
  ...buildExchangeRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: requireAuth(
      (
        request: Request,
        url: URL,
        _marketData: MarketDataHttpService,
        _health: HealthHttpService,
        _userData: UserDataHttpService,
        exchange: ExchangeHttpService,
        userId?: string,
      ) => route.handler(request, url, exchange, userId),
    ),
  })),
  ...buildCredentialRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: requireAuth(
      (
        request: Request,
        url: URL,
        _marketData: MarketDataHttpService,
        _health: HealthHttpService,
        _userData: UserDataHttpService,
        _exchange: ExchangeHttpService,
        userId?: string,
      ) =>
        Effect.gen(function* () {
          const accountRepo = yield* ExchangeAccountRepo;
          const credentialRepo = yield* ExchangeCredentialRepo;
          return yield* route.handler(request, url, accountRepo, credentialRepo, userId);
        }),
    ),
  })),
  ...buildAuthRoutes().map((route) => ({
    method: route.method,
    path: route.path,
    handler: adaptAuthRoute(route.handler),
  })),
];

export const handleRequest = (request: Request) => {
  return Effect.gen(function* () {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    const route = routes.find(
      (candidate) => matchPath(candidate.path, path) && candidate.method === method,
    );
    if (!route) {
      if (routes.some((candidate) => matchPath(candidate.path, path))) {
        return json({ error: `Method ${method} not allowed` }, 405);
      }
      return json({ error: "Not found" }, 404);
    }

    const marketData = yield* MarketDataService;
    const health = yield* HealthService;
    const userData = yield* UserDataService;
    const exchange = yield* ExchangeService;
    return yield* route.handler(request, url, marketData, health, userData, exchange);
  }).pipe(
    Effect.catch((error: HttpError) => {
      const body: Record<string, unknown> = { error: error.message };
      if (error.code) {
        body.code = error.code;
      }
      return Effect.succeed(json(body, error.status));
    }),
  );
};
