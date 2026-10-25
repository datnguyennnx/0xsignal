import { Effect, Option, Schema } from "effect";
import { HealthService } from "../../application/health";
import { MarketDataService } from "../../application/market-data/contracts";
import { UserDataService } from "../../application/user-data/contracts";
import { ExchangeService } from "../../application/exchange/contracts";
import { CalendarService } from "../../application/calendar/contracts";
import { WhaleService } from "../../application/whales/contracts";
import { asHttpError, errorResponse, type HttpError } from "./error-response";
import { json, routes } from "./route-table";
import type { HttpRequestServices } from "./route-contracts";

const HttpErrorSchema = Schema.Struct({
  status: Schema.Int,
  message: Schema.String,
  code: Schema.optional(Schema.String),
  retryable: Schema.Boolean,
});

const decodeHttpError = Schema.decodeUnknownOption(HttpErrorSchema, { onExcessProperty: "error" });

const internalErrorResponse = (): Response =>
  errorResponse(asHttpError(500, "Internal server error"), {});

const matchPath = (pattern: string, path: string): boolean => {
  if (pattern === path) return true;

  if (pattern.includes(":")) {
    const regexStr = pattern.replaceAll(/:([^/]+)/g, "([^/]+)");
    return new RegExp(`^${regexStr}$`).test(path);
  }

  return false;
};

export const handleRequest = (
  request: Request,
): Effect.Effect<Response, never, HttpRequestServices> => {
  return Effect.gen(function* () {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    const route = routes.find(
      (candidate) => matchPath(candidate.path, path) && candidate.method === method,
    );
    if (!route) {
      if (routes.some((candidate) => matchPath(candidate.path, path))) {
        return json({ error: `Method ${method} not allowed` }, 405);
      }
      return json({ error: "Not found" }, 404);
    }

    const marketData = yield* MarketDataService;
    const health = yield* HealthService;
    const userData = yield* UserDataService;
    const exchange = yield* ExchangeService;
    const calendar = Option.getOrUndefined(yield* Effect.serviceOption(CalendarService));
    const whale = Option.getOrUndefined(yield* Effect.serviceOption(WhaleService));
    return yield* route.handler(
      request,
      url,
      marketData,
      health,
      userData,
      exchange,
      calendar,
      whale,
    );
  }).pipe(
    Effect.catch((error: unknown) => {
      const decoded = decodeHttpError(error);
      if (Option.isNone(decoded)) {
        return Effect.succeed(internalErrorResponse());
      }

      const httpError: HttpError = decoded.value;
      const body: Record<string, unknown> = { error: httpError.message };
      if (httpError.code !== undefined && httpError.code !== "") {
        body.code = httpError.code;
      }
      return Effect.succeed(json(body, httpError.status));
    }),
  );
};
