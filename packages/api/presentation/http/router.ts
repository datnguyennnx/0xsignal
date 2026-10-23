import { Effect, Option } from "effect";
import { HealthService } from "../../application/health";
import { MarketDataService } from "../../application/market-data/contracts";
import { UserDataService } from "../../application/user-data/contracts";
import { ExchangeService } from "../../application/exchange/contracts";
import { CalendarService } from "../../application/calendar/contracts";
import { WhaleService } from "../../application/whales/contracts";
import type { HttpError } from "./error-response";
import { json, routes } from "./route-table";
import type { HttpRequestServices } from "./route-contracts";

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
    Effect.catch((error: HttpError) => {
      const body: Record<string, unknown> = { error: error.message };
      if (error.code !== undefined && error.code !== "") {
        body.code = error.code;
      }
      return Effect.succeed(json(body, error.status));
    }),
  );
};
