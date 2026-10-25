import { Effect, Schema, type Context } from "effect";
import type { OrderIntentRequest, OrderIntentResultRequest } from "@0xsignal/shared";
import { asHttpError, type HttpError } from "../../platform/http/error-response";
import { requireUserId } from "../../platform/http/require-user";
import { DecimalAmountSchema, NonNegativeDecimalSchema } from "./decimal-schema";
import type { OrderIntentService } from "./intent-service";

type OrderIntentHttpService = Context.Service.Shape<typeof OrderIntentService>;

type RouteHandler = (
  request: Request,
  url: URL,
  intents: OrderIntentHttpService,
  userId?: string,
) => Effect.Effect<Response, HttpError>;

const TimeInForceSchema = Schema.Literals(["GTC", "IOC", "FOK", "Alo", "FrontendMarket"]);

const OrderIntentRequestSchema: Schema.Decoder<OrderIntentRequest> = Schema.Struct({
  symbol: Schema.String,
  side: Schema.Literals(["buy", "sell"]),
  size: DecimalAmountSchema,
  price: Schema.Union([NonNegativeDecimalSchema, Schema.Null]),
  orderType: Schema.Literals(["limit", "market"]),
  timeInForce: Schema.optional(TimeInForceSchema),
  reduceOnly: Schema.optional(Schema.Boolean),
  slippageBps: Schema.optional(
    Schema.Number.pipe(
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(0),
        Schema.isLessThanOrEqualTo(10_000),
      ),
    ),
  ),
  leverage: Schema.optional(
    Schema.Number.pipe(Schema.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100))),
  ),
});

const OrderIntentResultRequestSchema: Schema.Decoder<OrderIntentResultRequest> = Schema.Union([
  Schema.Struct({
    txHash: Schema.String.pipe(
      Schema.check(
        Schema.isPattern(/^0x[0-9a-fA-F]+$/, {
          message: "expected a 0x-prefixed transaction hash",
        }),
      ),
    ),
  }),
  Schema.Struct({
    error: Schema.String.pipe(
      Schema.check(Schema.isPattern(/\S/, { message: "expected a non-empty error message" })),
    ),
  }),
]);

const decodeBody = <A>(schema: Schema.Decoder<A>, request: Request): Effect.Effect<A, HttpError> =>
  Effect.gen(function* () {
    const raw: unknown = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => asHttpError(400, "Invalid request body"),
    });
    return yield* Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(raw).pipe(
      Effect.mapError((err) => asHttpError(400, `Invalid request body: ${err.message}`)),
    );
  });

const intentIdFromPath = (pathname: string): string | null => {
  const segments = pathname.split("/").filter((segment) => segment !== "");
  const id = segments[3];
  return id === undefined ? null : decodeURIComponent(id);
};

export const buildIntentRoutes = ({
  json,
  mapServiceError,
}: {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
}): Array<{ method: string; path: string; handler: RouteHandler }> => [
  {
    method: "POST",
    path: "/api/exchange/intent",
    handler: (request, _url, intents, userId) =>
      Effect.gen(function* () {
        const sessionUserId = yield* requireUserId(userId);
        const body = yield* decodeBody(OrderIntentRequestSchema, request);
        const payload = yield* intents
          .create(body, sessionUserId)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "POST",
    path: "/api/exchange/intent/:id/result",
    handler: (request, url, intents, userId) =>
      Effect.gen(function* () {
        const sessionUserId = yield* requireUserId(userId);
        const id = intentIdFromPath(url.pathname);
        if (id === null) return yield* Effect.fail(asHttpError(404, "Order intent not found"));

        const body = yield* decodeBody(OrderIntentResultRequestSchema, request);
        const payload = yield* intents
          .recordResult(id, body, sessionUserId)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
];
