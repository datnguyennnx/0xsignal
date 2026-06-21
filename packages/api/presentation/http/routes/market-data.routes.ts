import { Effect } from "effect";
import { MarketDataService } from "../../../application/market-data/contracts";
import type { HttpError } from "../error-response";
import {
  parseInterval,
  parseOptionalDate,
  parseOptionalPositiveInt,
  parseOptionalSigFigs,
  parseRequiredString,
} from "./market-data.query-parsers";

type MarketDataHttpService = {
  readonly discoverMarkets: (typeof MarketDataService.Service)["discoverMarkets"];
  readonly getCandles: (typeof MarketDataService.Service)["getCandles"];
  readonly getRecentCandles: (typeof MarketDataService.Service)["getRecentCandles"];
  readonly getTicker: (typeof MarketDataService.Service)["getTicker"];
  readonly getOrderBook: (typeof MarketDataService.Service)["getOrderBook"];
  readonly getTradeAnnotation: (typeof MarketDataService.Service)["getTradeAnnotation"];
};

type RouteHandler = (
  request: Request,
  url: URL,
  marketData: MarketDataHttpService,
) => Effect.Effect<Response, HttpError>;

type BuildMarketDataRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

export const buildMarketDataRoutes = ({
  json,
  mapServiceError,
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
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/candles",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        const symbol = yield* parseRequiredString(url.searchParams, "symbol");
        const interval = yield* parseInterval(url.searchParams);
        const exchange = url.searchParams.get("exchange")?.trim() || "Hyperliquid";
        const startTime = yield* parseOptionalDate(url.searchParams, "start_time");
        const endTime = yield* parseOptionalDate(url.searchParams, "end_time");
        const limit = yield* parseOptionalPositiveInt(url.searchParams, "limit");

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

        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/candles/recent",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        const symbol = yield* parseRequiredString(url.searchParams, "symbol");
        const interval = yield* parseInterval(url.searchParams);
        const exchange = url.searchParams.get("exchange")?.trim() || "Hyperliquid";
        const endTime = yield* parseOptionalDate(url.searchParams, "end_time");
        const limit = yield* parseOptionalPositiveInt(url.searchParams, "limit");

        const payload = yield* marketData
          .getRecentCandles({
            symbol,
            exchange,
            timeframe: interval,
            endTime,
            limit,
          })
          .pipe(Effect.mapError(mapServiceError));

        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/ticker",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        const symbol = yield* parseRequiredString(url.searchParams, "symbol");
        const payload = yield* marketData.getTicker(symbol).pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/orderbook",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        const symbol = yield* parseRequiredString(url.searchParams, "symbol");
        const precision = yield* parseOptionalSigFigs(url.searchParams, "nSigFigs");
        const payload = yield* marketData
          .getOrderBook(symbol, precision)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
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
        return json({ data: payload });
      }),
  },
];
