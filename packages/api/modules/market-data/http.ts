import { Effect } from "effect";
import { MarketDataService } from "./index";
import type { HttpError } from "../../platform/http/error-response";
import {
  DEFAULT_EXCHANGE,
  parseMarketCandlesQuery,
  parseMarketOrderBookQuery,
  parseMarketRecentCandlesQuery,
  parseMarketSymbolQuery,
} from "./query";

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
        const query = yield* parseMarketCandlesQuery(url.searchParams);

        const payload = yield* marketData
          .getCandles({
            symbol: query.symbol,
            exchange: query.exchange ?? DEFAULT_EXCHANGE,
            timeframe: query.interval,
            startTime: query.start_time,
            endTime: query.end_time,
            limit: query.limit,
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
        const query = yield* parseMarketRecentCandlesQuery(url.searchParams);

        const payload = yield* marketData
          .getRecentCandles({
            symbol: query.symbol,
            exchange: query.exchange ?? DEFAULT_EXCHANGE,
            timeframe: query.interval,
            endTime: query.end_time,
            limit: query.limit,
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
        const query = yield* parseMarketSymbolQuery(url.searchParams);
        const payload = yield* marketData
          .getTicker(query.symbol)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/orderbook",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        const query = yield* parseMarketOrderBookQuery(url.searchParams);
        const payload = yield* marketData
          .getOrderBook(query.symbol, query.nSigFigs ?? null)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/trade-annotation",
    handler: (_request, url, marketData) =>
      Effect.gen(function* () {
        const query = yield* parseMarketSymbolQuery(url.searchParams);
        const payload = yield* marketData
          .getTradeAnnotation(query.symbol)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
];
