import { Effect } from "effect";
import { ExchangeServices } from "../../../application/exchange/contracts";

/** Derived from ExchangeServices contract to avoid `any` in route body parsing. */
type PlaceOrderBody = Parameters<(typeof ExchangeServices.Service)["placeOrder"]>[0];

type HttpError = {
  readonly status: number;
  readonly message: string;
};

type ExchangeHttpService = {
  readonly placeOrder: (typeof ExchangeServices.Service)["placeOrder"];
  readonly updateLeverageAndMargin: (typeof ExchangeServices.Service)["updateLeverageAndMargin"];
  readonly cancelOrders: (typeof ExchangeServices.Service)["cancelOrders"];
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
          try: () => request.json() as Promise<PlaceOrderBody>,
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
          try: () =>
            request.json() as Promise<{
              asset: number;
              isCross: boolean;
              leverage: number;
            }>,
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
          try: () =>
            request.json() as Promise<{
              cancels: Array<{ coin: string; o: number }>;
            }>,
          catch: () => ({ error: "Invalid JSON body" }),
        }).pipe(Effect.mapError(() => ({ status: 400, message: "Invalid request body" })));

        const payload = yield* exchange.cancelOrders(body).pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
];
