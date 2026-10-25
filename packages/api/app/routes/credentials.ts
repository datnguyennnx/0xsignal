import { Effect } from "effect";
import { ExchangeAccountRepo, withAuth } from "@0xsignal/auth";
import { buildCredentialRoutes } from "../../modules/credentials";
import { json } from "../../platform/http/error-response";
import type { Route } from "../../platform/http/route-contracts";
import type { HttpRequestServices } from "../contracts";
import { withDefectGuard } from "../defect-guard";
import { mapServiceError } from "../error-mapping";

export const credentialRoutes: ReadonlyArray<Route<HttpRequestServices>> = buildCredentialRoutes({
  json,
  mapServiceError,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request, url) =>
    withDefectGuard(
      Effect.gen(function* () {
        const accountRepo = yield* ExchangeAccountRepo;
        return yield* withAuth((session) =>
          route.handler(request, url, accountRepo, session.userId),
        )(request);
      }),
    ),
}));
