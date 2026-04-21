/** HTTP Router - Route matching with functional patterns */

import { Effect } from "effect";
import { MarketDataServices } from "@application/market-data";
import { DomainError } from "@application/errors";
import { IS_DEV_MODE } from "@infrastructure/config/mode";
import { healthRoute } from "./routes/health.routes";
import { parseOptionalSigFigsParam } from "./param-parsers";

const CANDLE_TIMING_LOGS_ENABLED = IS_DEV_MODE;

const logCandleRouteTiming = (payload: Record<string, unknown>) =>
  CANDLE_TIMING_LOGS_ENABLED
    ? Effect.logInfo(JSON.stringify({ event: "candle_route_timing", ...payload }))
    : Effect.succeed(undefined);

const extractCandleCount = (payload: unknown): number | undefined => {
  if (typeof payload !== "object" || payload === null || !("candles" in payload)) {
    return undefined;
  }

  const candles = (payload as { candles?: unknown }).candles;
  return Array.isArray(candles) ? candles.length : undefined;
};

type HttpError = {
  readonly status: number;
  readonly message: string;
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

type RouteHandler = (
  request: Request,
  url: URL,
  marketData: MarketDataHttpService
) => Effect.Effect<Response, HttpError>;

const MARKET_INTERVALS = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "8h",
  "12h",
  "1d",
  "1w",
] as const;

type MarketInterval = (typeof MARKET_INTERVALS)[number];

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

const badRequest = (message: string): Effect.Effect<never, HttpError> =>
  Effect.fail({ status: 400, message });

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

const parseRequiredString = (
  params: URLSearchParams,
  key: string
): Effect.Effect<string, HttpError> => {
  const value = params.get(key)?.trim();
  if (!value) {
    return badRequest(`Missing required query parameter: ${key}`);
  }
  return Effect.succeed(value);
};

const parseOptionalDate = (
  params: URLSearchParams,
  key: string
): Effect.Effect<Date | undefined, HttpError> => {
  const value = params.get(key);
  if (!value) {
    return Effect.succeed(undefined);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return badRequest(`Invalid date for ${key}: ${value}`);
  }

  return Effect.succeed(parsed);
};

const parseOptionalPositiveInt = (
  params: URLSearchParams,
  key: string
): Effect.Effect<number | undefined, HttpError> => {
  const value = params.get(key);
  if (!value) {
    return Effect.succeed(undefined);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return badRequest(`Invalid integer for ${key}: ${value}`);
  }

  return Effect.succeed(parsed);
};

const parseOptionalSigFigs = (
  params: URLSearchParams,
  key: string
): Effect.Effect<2 | 3 | 4 | 5 | undefined, HttpError> => {
  const value = parseOptionalSigFigsParam(params, key);
  if (value === null) {
    return badRequest(`Invalid ${key}: ${params.get(key)}. Supported values are 2, 3, 4, 5.`);
  }

  return Effect.succeed(value);
};

const parseInterval = (params: URLSearchParams): Effect.Effect<MarketInterval, HttpError> => {
  const value = params.get("interval") ?? params.get("timeframe");
  if (!value) {
    return badRequest("Missing required query parameter: interval");
  }
  if (!MARKET_INTERVALS.includes(value as MarketInterval)) {
    return badRequest(`Unsupported interval: ${value}`);
  }
  return Effect.succeed(value as MarketInterval);
};

const routes: Array<{ method: string; path: string; handler: RouteHandler }> = [
  {
    method: "GET",
    path: "/api/health",
    handler: () => healthRoute().pipe(Effect.map((body) => json(body))),
  },
  {
    method: "GET",
    path: "/api/markets",
    handler: (_request, _url, marketData) =>
      Effect.gen(function* () {
        const payload = yield* marketData.discoverMarkets().pipe(Effect.mapError(mapServiceError));
        return json(payload);
      }),
  },
  {
    method: "GET",
    path: "/api/candles",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        // Canonical historical/reconciled lane (QuestDB + coverage orchestration).
        const startedAt = Date.now();
        const symbol = yield* parseRequiredString(url.searchParams, "symbol");
        const interval = yield* parseInterval(url.searchParams);
        const exchange = url.searchParams.get("exchange")?.trim() || "Hyperliquid";
        const startTime = yield* parseOptionalDate(url.searchParams, "start_time");
        const endTime = yield* parseOptionalDate(url.searchParams, "end_time");
        const limit = yield* parseOptionalPositiveInt(url.searchParams, "limit");
        const parsedAt = Date.now();

        const payload = yield* marketData
          .getCandles({
            symbol,
            exchange,
            timeframe: interval,
            startTime,
            endTime,
            limit,
          })
          .pipe(Effect.mapError(mapServiceError));
        const serviceFinishedAt = Date.now();

        const response = json(payload);
        const respondedAt = Date.now();

        yield* logCandleRouteTiming({
          route: "/api/candles",
          symbol,
          interval,
          parse_ms: parsedAt - startedAt,
          service_ms: serviceFinishedAt - parsedAt,
          response_ms: respondedAt - serviceFinishedAt,
          total_ms: respondedAt - startedAt,
          row_count: extractCandleCount(payload),
        });

        return response;
      }),
  },
  {
    method: "GET",
    path: "/api/candles/recent",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        // Low-latency recent snapshot lane for render bootstrap.
        const startedAt = Date.now();
        const symbol = yield* parseRequiredString(url.searchParams, "symbol");
        const interval = yield* parseInterval(url.searchParams);
        const exchange = url.searchParams.get("exchange")?.trim() || "Hyperliquid";
        const endTime = yield* parseOptionalDate(url.searchParams, "end_time");
        const limit = yield* parseOptionalPositiveInt(url.searchParams, "limit");
        const parsedAt = Date.now();

        const payload = yield* marketData
          .getRecentCandles({
            symbol,
            exchange,
            timeframe: interval,
            endTime,
            limit,
          })
          .pipe(Effect.mapError(mapServiceError));
        const serviceFinishedAt = Date.now();

        const response = json(payload);
        const respondedAt = Date.now();

        yield* logCandleRouteTiming({
          route: "/api/candles/recent",
          symbol,
          interval,
          parse_ms: parsedAt - startedAt,
          service_ms: serviceFinishedAt - parsedAt,
          response_ms: respondedAt - serviceFinishedAt,
          total_ms: respondedAt - startedAt,
          row_count: extractCandleCount(payload),
        });

        return response;
      }),
  },
  {
    method: "GET",
    path: "/api/candles/coverage",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        const symbol = yield* parseRequiredString(url.searchParams, "symbol");
        const interval = yield* parseInterval(url.searchParams);
        const exchange = url.searchParams.get("exchange")?.trim() || "Hyperliquid";
        const startTime = yield* parseOptionalDate(url.searchParams, "start_time");
        const endTime = yield* parseOptionalDate(url.searchParams, "end_time");

        if (!startTime || !endTime) {
          return yield* badRequest("start_time and end_time are required");
        }

        const payload = yield* marketData
          .inspectCoverage({
            symbol,
            exchange,
            timeframe: interval,
            startTime,
            endTime,
          })
          .pipe(Effect.mapError(mapServiceError));

        return json(payload);
      }),
  },
  {
    method: "GET",
    path: "/api/ticker",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        const symbol = yield* parseRequiredString(url.searchParams, "symbol");
        const payload = yield* marketData.getTicker(symbol).pipe(Effect.mapError(mapServiceError));
        return json(payload);
      }),
  },
  {
    method: "GET",
    path: "/api/orderbook",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        const symbol = yield* parseRequiredString(url.searchParams, "symbol");
        const nSigFigs = yield* parseOptionalSigFigs(url.searchParams, "nSigFigs");
        const depth = yield* parseOptionalSigFigs(url.searchParams, "depth");
        const precision = nSigFigs ?? depth;
        const payload = yield* marketData
          .getOrderBook(symbol, precision)
          .pipe(Effect.mapError(mapServiceError));
        return json(payload);
      }),
  },
  {
    method: "GET",
    path: "/api/trade-annotation",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        const symbol = yield* parseRequiredString(url.searchParams, "symbol");
        const payload = yield* marketData
          .getTradeAnnotation(symbol)
          .pipe(Effect.mapError(mapServiceError));
        return json(payload);
      }),
  },
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
    return yield* route.handler(request, url, marketData);
  });
};
