import { Effect } from "effect";
import { MarketDataServices } from "@application/market-data";
import {
  parseInterval,
  parseOptionalDate,
  parseOptionalPositiveInt,
  parseOptionalSigFigs,
  parseRequiredString,
} from "./market-data.query-parsers";

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

type BuildMarketDataRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
  readonly logCandleRouteTiming: (payload: Record<string, unknown>) => Effect.Effect<void, never>;
  readonly extractCandleCount: (payload: unknown) => number | undefined;
};

export const buildMarketDataRoutes = ({
  json,
  mapServiceError,
  logCandleRouteTiming,
  extractCandleCount,
}: BuildMarketDataRoutesParams): Array<{
  method: string;
  path: string;
  handler: RouteHandler;
}> => [
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
          return yield* Effect.fail({
            status: 400,
            message: "start_time and end_time are required",
          });
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
