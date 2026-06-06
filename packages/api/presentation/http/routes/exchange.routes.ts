import { Effect } from "effect";
import { z } from "zod";
import { ExchangeService } from "../../../application/exchange/contracts";

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
  exchange: ExchangeHttpService,
  userId?: string
) => Effect.Effect<Response, HttpError>;

type BuildExchangeRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

const OrderTypeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("limit"),
    timeInForce: z.enum(["GTC", "IOC", "FOK", "Alo", "FrontendMarket"]),
  }),
  z.object({
    kind: z.literal("trigger"),
    isMarket: z.boolean(),
    triggerPrice: z.string(),
    tpsl: z.enum(["tp", "sl"]),
  }),
]);

const PlaceOrderEntrySchema = z.object({
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  quantity: z.string(),
  price: z.string(),
  reduceOnly: z.boolean(),
  orderType: OrderTypeSchema,
});

const PlaceOrderRequestSchema = z.object({
  orders: z.array(PlaceOrderEntrySchema),
  grouping: z.enum(["na", "normalTpsl", "positionTpsl"]).optional(),
});

const UpdateLeverageRequestSchema = z.object({
  symbol: z.string(),
  isCross: z.boolean(),
  leverage: z.number().positive(),
});

const CancelEntrySchema = z.object({
  symbol: z.string(),
  orderId: z.number(),
});

const CancelOrdersRequestSchema = z.object({
  cancels: z.array(CancelEntrySchema),
});

const asHttpError = (status: number, message: string): HttpError => ({ status, message });

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
    handler: (request: Request, _url: URL, exchange: ExchangeHttpService, userId?: string) =>
      Effect.gen(function* () {
        if (!userId) {
          return yield* Effect.fail(asHttpError(401, "Authentication required"));
        }

        const raw = yield* Effect.tryPromise({
          try: () => request.json(),
          catch: () => asHttpError(400, "Invalid request body"),
        });

        const parsed = PlaceOrderRequestSchema.safeParse(raw);
        if (!parsed.success) {
          return yield* Effect.fail(
            asHttpError(400, `Invalid request body: ${parsed.error.message}`)
          );
        }

        const payload = yield* exchange
          .placeOrder(parsed.data, userId)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "POST",
    path: "/api/exchange/leverage",
    handler: (request: Request, _url: URL, exchange: ExchangeHttpService, userId?: string) =>
      Effect.gen(function* () {
        if (!userId) {
          return yield* Effect.fail(asHttpError(401, "Authentication required"));
        }

        const raw = yield* Effect.tryPromise({
          try: () => request.json(),
          catch: () => asHttpError(400, "Invalid request body"),
        });

        const parsed = UpdateLeverageRequestSchema.safeParse(raw);
        if (!parsed.success) {
          return yield* Effect.fail(
            asHttpError(400, `Invalid request body: ${parsed.error.message}`)
          );
        }

        const payload = yield* exchange
          .updateLeverageAndMargin(parsed.data, userId)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "POST",
    path: "/api/exchange/cancel",
    handler: (request: Request, _url: URL, exchange: ExchangeHttpService, userId?: string) =>
      Effect.gen(function* () {
        if (!userId) {
          return yield* Effect.fail(asHttpError(401, "Authentication required"));
        }

        const raw = yield* Effect.tryPromise({
          try: () => request.json(),
          catch: () => asHttpError(400, "Invalid request body"),
        });

        const parsed = CancelOrdersRequestSchema.safeParse(raw);
        if (!parsed.success) {
          return yield* Effect.fail(
            asHttpError(400, `Invalid request body: ${parsed.error.message}`)
          );
        }

        const payload = yield* exchange
          .cancelOrders(parsed.data, userId)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
];
