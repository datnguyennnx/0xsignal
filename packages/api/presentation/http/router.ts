/** HTTP Router - Route matching with functional patterns */

import { Effect } from "effect";
import { HealthServices } from "../../application/health";
import { MarketDataServices } from "../../application/market-data/contracts";
import { UserDataServices } from "../../application/user-data/contracts";
import { DomainError } from "../../application/errors";
import { healthRoute } from "./routes/health.routes";
import { buildMarketDataRoutes } from "./routes/market-data.routes";
import { buildUserDataRoutes } from "./routes/user-data.routes";

type HttpError = {
  readonly status: number;
  readonly message: string;
};

type UserDataHttpService = {
  readonly getClearinghouseState: (typeof UserDataServices.Service)["getClearinghouseState"];
  readonly getOpenOrders: (typeof UserDataServices.Service)["getOpenOrders"];
  readonly getHistoricalOrders: (typeof UserDataServices.Service)["getHistoricalOrders"];
  readonly getUserFills: (typeof UserDataServices.Service)["getUserFills"];
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
  userData: UserDataHttpService
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
    handler: (_request, _url, _marketData, health) =>
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
      _userData: UserDataHttpService
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
      userData: UserDataHttpService
    ) => route.handler(request, url, userData),
  })),
];

// Main router - returns Effect with any requirements
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
        return yield* Effect.fail({ status: 405, message: `Method ${method} not allowed` });
      }
      return yield* Effect.fail({ status: 404, message: "Not found" });
    }

    const marketData = yield* MarketDataServices;
    const health = yield* HealthServices;
    const userData = yield* UserDataServices;
    return yield* route.handler(request, url, marketData, health, userData);
  });
};
