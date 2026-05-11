/** HTTP Router - Route matching with functional patterns */

import { Effect } from "effect";
import { HealthServices } from "../../application/health";
import { MarketDataServices } from "../../application/market-data/contracts";
import { UserDataServices } from "../../application/user-data/contracts";
import { ExchangeServices } from "../../application/exchange/contracts";
import { DomainError } from "../../application/errors";
import { healthRoute } from "./routes/health.routes";
import { buildMarketDataRoutes } from "./routes/market-data.routes";
import { buildUserDataRoutes } from "./routes/user-data.routes";
import { buildExchangeRoutes } from "./routes/exchange.routes";

type HttpError = {
  readonly status: number;
  readonly message: string;
};

type UserDataHttpService = {
  readonly getClearinghouseState: (typeof UserDataServices.Service)["getClearinghouseState"];
  readonly getSpotClearinghouseState: (typeof UserDataServices.Service)["getSpotClearinghouseState"];
  readonly getOpenOrders: (typeof UserDataServices.Service)["getOpenOrders"];
  readonly getFrontendOpenOrders: (typeof UserDataServices.Service)["getFrontendOpenOrders"];
  readonly getMeta: (typeof UserDataServices.Service)["getMeta"];
  readonly getHistoricalOrders: (typeof UserDataServices.Service)["getHistoricalOrders"];
  readonly getUserFills: (typeof UserDataServices.Service)["getUserFills"];
};

type ExchangeHttpService = {
  readonly placeOrder: (typeof ExchangeServices.Service)["placeOrder"];
  readonly updateLeverageAndMargin: (typeof ExchangeServices.Service)["updateLeverageAndMargin"];
  readonly cancelOrders: (typeof ExchangeServices.Service)["cancelOrders"];
};

type MarketDataHttpService = {
  readonly discoverMarkets: (typeof MarketDataServices.Service)["discoverMarkets"];
  readonly getCandles: (typeof MarketDataServices.Service)["getCandles"];
  readonly getRecentCandles: (typeof MarketDataServices.Service)["getRecentCandles"];
  readonly inspectCoverage: (typeof MarketDataServices.Service)["inspectCoverage"];
  readonly getTicker: (typeof MarketDataServices.Service)["getTicker"];
  readonly getOrderBook: (typeof MarketDataServices.Service)["getOrderBook"];
  readonly getTradeAnnotation: (typeof MarketDataServices.Service)["getTradeAnnotation"];
};

type HealthHttpService = Parameters<typeof healthRoute>[0];

type RouteHandler = (
  request: Request,
  url: URL,
  marketData: MarketDataHttpService,
  health: HealthHttpService,
  userData: UserDataHttpService,
  exchange: ExchangeHttpService
) => Effect.Effect<Response, HttpError>;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

const mapDomainCodeToHttpStatus = (code: DomainError["code"]): number => {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "ALREADY_EXISTS":
    case "CONFLICT":
    case "INVALID_STATE":
      return 409;
    case "INTERNAL_ERROR":
      return 502;
    default:
      return 500;
  }
};

const mapServiceError = (error: unknown): HttpError => {
  if (error instanceof DomainError) {
    return {
      status: mapDomainCodeToHttpStatus(error.code),
      message: error.message,
    };
  }

  if (error && typeof error === "object" && "_tag" in error) {
    const tagged = error as { _tag: string; message: string };
    switch (tagged._tag) {
      case "HyperliquidValidationError":
      case "InsufficientMarginError":
        return { status: 400, message: tagged.message };
      case "HyperliquidInternalError":
        return { status: 502, message: tagged.message };
      default:
        return { status: 500, message: tagged.message };
    }
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as { status?: unknown; message?: unknown };
    if (typeof candidate.status === "number" && typeof candidate.message === "string") {
      return {
        status: candidate.status,
        message: candidate.message,
      };
    }
    if (typeof candidate.message === "string") {
      return { status: 500, message: candidate.message };
    }
  }

  return { status: 500, message: "Internal server error" };
};

const routes: Array<{ method: string; path: string; handler: RouteHandler }> = [
  {
    method: "GET",
    path: "/api/health",
    handler: (_request, _url, _marketData, health, _userData, _exchange) =>
      healthRoute(health).pipe(Effect.map((body) => json(body))),
  },
  ...buildMarketDataRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: (
      request: Request,
      url: URL,
      marketData: MarketDataHttpService,
      _health: HealthHttpService,
      _userData: UserDataHttpService,
      _exchange: ExchangeHttpService
    ) => route.handler(request, url, marketData),
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
      _exchange: ExchangeHttpService
    ) => route.handler(request, url, userData),
  })),
  ...buildExchangeRoutes({
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
      _userData: UserDataHttpService,
      exchange: ExchangeHttpService
    ) => route.handler(request, url, exchange),
  })),
];

// Main router - returns Response with all errors handled internally
export const handleRequest = (request: Request) => {
  return Effect.gen(function* () {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    const route = routes.find(
      (candidate) => candidate.path === path && candidate.method === method
    );
    if (!route) {
      if (routes.some((candidate) => candidate.path === path)) {
        return json({ error: `Method ${method} not allowed` }, 405);
      }
      return json({ error: "Not found" }, 404);
    }

    const marketData = yield* MarketDataServices;
    const health = yield* HealthServices;
    const userData = yield* UserDataServices;
    const exchange = yield* ExchangeServices;
    return yield* route.handler(request, url, marketData, health, userData, exchange);
  }).pipe(
    Effect.catchAll((error: HttpError) =>
      Effect.succeed(json({ error: error.message }, error.status))
    )
  );
};
