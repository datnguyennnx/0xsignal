import { Effect } from "effect";
import { json } from "../../platform/http/error-response";
import type { Route } from "../../platform/http/route-contracts";
import { HealthService } from "../../modules/health";
import { buildHealthRoutes } from "../../modules/health/http";
import type { HttpRequestServices } from "../contracts";

export const healthRoutes: ReadonlyArray<Route<HttpRequestServices>> = buildHealthRoutes({
  json,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request, url) =>
    Effect.gen(function* () {
      const health = yield* HealthService;
      return yield* route.handler(request, url, health);
    }),
}));
