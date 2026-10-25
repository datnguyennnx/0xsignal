import { Effect } from "effect";
import { UserDataService } from "../../modules/user-data";
import { buildUserDataRoutes } from "../../modules/user-data/http";
import { json } from "../../platform/http/error-response";
import type { Route } from "../../platform/http/route-contracts";
import type { HttpRequestServices } from "../contracts";
import { mapServiceError } from "../error-mapping";

export const userDataRoutes: ReadonlyArray<Route<HttpRequestServices>> = buildUserDataRoutes({
  json,
  mapServiceError,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request, url) =>
    Effect.gen(function* () {
      const userData = yield* UserDataService;
      return yield* route.handler(request, url, userData);
    }),
}));
