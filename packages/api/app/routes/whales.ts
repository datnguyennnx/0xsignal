import { Effect, Option } from "effect";
import { WhaleService } from "../../modules/whales";
import { buildWhaleRoutes } from "../../modules/whales/http";
import { json } from "../../platform/http/error-response";
import type { Route } from "../../platform/http/route-contracts";
import type { HttpRequestServices } from "../contracts";
import { mapServiceError } from "../error-mapping";

export const whaleRoutes: ReadonlyArray<Route<HttpRequestServices>> = buildWhaleRoutes({
  json,
  mapServiceError,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request, url) =>
    Effect.gen(function* () {
      const whale = Option.getOrUndefined(yield* Effect.serviceOption(WhaleService));
      return whale === undefined
        ? json({ error: "Whale service unavailable" }, 503)
        : yield* route.handler(request, url, whale);
    }),
}));
