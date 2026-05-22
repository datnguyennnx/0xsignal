import { Effect } from "effect";
import { ExchangeService } from "../../../application/exchange/contracts";
import type {
  PlaceOrderRequest,
  UpdateLeverageRequest,
  CancelOrdersRequest,
} from "../../../application/exchange/types";

type HttpError = {
  readonly status: number;
  readonly message: string;
};

type ExchangeHttpService = {
  readonly placeOrder: (typeof ExchangeService.Service)["placeOrder"];
  readonly updateLeverageAndMargin: (typeof ExchangeService.Service)["updateLeverageAndMargin"];
  readonly cancelOrders: (typeof ExchangeService.Service)["cancelOrders"];
};

type RouteHandler = (
  request: Request,
  url: URL,
  exchange: ExchangeHttpService
) => Effect.Effect<Response, HttpError>;

type BuildExchangeRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

export const buildExchangeRoutes = ({
  json,
  mapServiceError,
}: BuildExchangeRoutesParams): Array<{
  method: string;
  path: string;
  handler: RouteHandler;
}> => [
  {
    method: "POST",
    path: "/api/exchange/order",
    handler: (request: Request, _url: URL, exchange: ExchangeHttpService) =>
      Effect.gen(function* () {
        const body = yield* Effect.tryPromise({
          try: () => request.json() as Promise<PlaceOrderRequest>,
          catch: () => ({ error: "Invalid JSON body" }),
        }).pipe(Effect.mapError(() => ({ status: 400, message: "Invalid request body" })));

        const payload = yield* exchange.placeOrder(body).pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "POST",
    path: "/api/exchange/leverage",
    handler: (request: Request, _url: URL, exchange: ExchangeHttpService) =>
      Effect.gen(function* () {
        const body = yield* Effect.tryPromise({
          try: () => request.json() as Promise<UpdateLeverageRequest>,
          catch: () => ({ error: "Invalid JSON body" }),
        }).pipe(Effect.mapError(() => ({ status: 400, message: "Invalid request body" })));

        const payload = yield* exchange
          .updateLeverageAndMargin(body)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "POST",
    path: "/api/exchange/cancel",
    handler: (request: Request, _url: URL, exchange: ExchangeHttpService) =>
      Effect.gen(function* () {
        const body = yield* Effect.tryPromise({
          try: () => request.json() as Promise<CancelOrdersRequest>,
          catch: () => ({ error: "Invalid JSON body" }),
        }).pipe(Effect.mapError(() => ({ status: 400, message: "Invalid request body" })));

        const payload = yield* exchange.cancelOrders(body).pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
];
