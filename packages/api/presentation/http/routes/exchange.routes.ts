import { Effect, Schema } from "effect";
import type {
  CancelEntry,
  CancelOrdersRequest,
  OrderType,
  PlaceOrderEntry,
  PlaceOrderRequest,
  UpdateLeverageRequest,
} from "@0xsignal/shared";
import { asHttpError, type HttpError } from "../error-response";
import { requireUserId } from "../require-user";
import type { ExchangeHttpService } from "../route-contracts";

type RouteHandler = (
  request: Request,
  url: URL,
  exchange: ExchangeHttpService,
  userId?: string,
) => Effect.Effect<Response, HttpError>;

type BuildExchangeRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

// Validators are projections of the shared contract, so a missing or retyped
// field here fails to compile.
const OrderTypeSchema: Schema.Decoder<OrderType> = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("limit"),
    timeInForce: Schema.Literals(["GTC", "IOC", "FOK", "Alo", "FrontendMarket"]),
  }),
  Schema.Struct({
    kind: Schema.Literal("trigger"),
    isMarket: Schema.Boolean,
    triggerPrice: Schema.String,
    tpsl: Schema.Literals(["tp", "sl"]),
  }),
]).pipe(Schema.toTaggedUnion("kind"));

const DECIMAL_AMOUNT_RE = /^(?=.*[1-9])\d+(\.\d+)?$/;
const NON_NEGATIVE_DECIMAL_RE = /^\d+(\.\d+)?$/;

const DecimalAmountSchema: Schema.Codec<string, string> = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(DECIMAL_AMOUNT_RE, { message: "expected a positive decimal string" }),
  ),
);

// "0" is syntactically valid for price; whether it is admissible depends on
// reduceOnly and timeInForce, which only the exchange service can judge.
const NonNegativeDecimalSchema: Schema.Codec<string, string> = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(NON_NEGATIVE_DECIMAL_RE, {
      message: "expected a non-negative decimal string",
    }),
  ),
);

const PlaceOrderEntrySchema: Schema.Decoder<PlaceOrderEntry> = Schema.Struct({
  symbol: Schema.String,
  side: Schema.Literals(["buy", "sell"]),
  quantity: DecimalAmountSchema,
  price: NonNegativeDecimalSchema,
  reduceOnly: Schema.Boolean,
  orderType: OrderTypeSchema,
});

const PlaceOrderRequestSchema: Schema.Decoder<PlaceOrderRequest> = Schema.Struct({
  orders: Schema.Array(PlaceOrderEntrySchema).pipe(Schema.mutable),
  grouping: Schema.optional(Schema.Literals(["na", "normalTpsl", "positionTpsl"])),
});

const UpdateLeverageRequestSchema: Schema.Decoder<UpdateLeverageRequest> = Schema.Struct({
  symbol: Schema.String,
  isCross: Schema.Boolean,
  leverage: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100)),
  ),
});

const CancelEntrySchema: Schema.Decoder<CancelEntry> = Schema.Struct({
  symbol: Schema.String,
  orderId: Schema.Number.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))),
});

const CancelOrdersRequestSchema: Schema.Decoder<CancelOrdersRequest> = Schema.Struct({
  cancels: Schema.Array(CancelEntrySchema).pipe(Schema.mutable),
});

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
        const sessionUserId = yield* requireUserId(userId);

        const raw: unknown = yield* Effect.tryPromise({
          try: () => request.json(),
          catch: () => asHttpError(400, "Invalid request body"),
        });

        const payload = yield* Schema.decodeUnknownEffect(PlaceOrderRequestSchema)(raw).pipe(
          Effect.mapError((err) => asHttpError(400, `Invalid request body: ${err.message}`)),
          Effect.flatMap((body) =>
            exchange.placeOrder(body, sessionUserId).pipe(Effect.mapError(mapServiceError)),
          ),
        );
        return json({ data: payload });
      }),
  },
  {
    method: "POST",
    path: "/api/exchange/leverage",
    handler: (request: Request, _url: URL, exchange: ExchangeHttpService, userId?: string) =>
      Effect.gen(function* () {
        const sessionUserId = yield* requireUserId(userId);

        const raw: unknown = yield* Effect.tryPromise({
          try: () => request.json(),
          catch: () => asHttpError(400, "Invalid request body"),
        });

        const payload = yield* Schema.decodeUnknownEffect(UpdateLeverageRequestSchema)(raw).pipe(
          Effect.mapError((err) => asHttpError(400, `Invalid request body: ${err.message}`)),
          Effect.flatMap((body) =>
            exchange
              .updateLeverageAndMargin(body, sessionUserId)
              .pipe(Effect.mapError(mapServiceError)),
          ),
        );
        return json({ data: payload });
      }),
  },
  {
    method: "POST",
    path: "/api/exchange/cancel",
    handler: (request: Request, _url: URL, exchange: ExchangeHttpService, userId?: string) =>
      Effect.gen(function* () {
        const sessionUserId = yield* requireUserId(userId);

        const raw: unknown = yield* Effect.tryPromise({
          try: () => request.json(),
          catch: () => asHttpError(400, "Invalid request body"),
        });

        const payload = yield* Schema.decodeUnknownEffect(CancelOrdersRequestSchema)(raw).pipe(
          Effect.mapError((err) => asHttpError(400, `Invalid request body: ${err.message}`)),
          Effect.flatMap((body) =>
            exchange.cancelOrders(body, sessionUserId).pipe(Effect.mapError(mapServiceError)),
          ),
        );
        return json({ data: payload });
      }),
  },
];
