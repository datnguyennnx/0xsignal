import { Effect } from "effect";
import { ExchangeAccountRepo, ExchangeCredentialRepo, withAuth } from "@0xsignal/auth";
import { CredentialVerifier } from "../../integrations/hyperliquid/data-sources/credential-verifier";
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
        const credentialRepo = yield* ExchangeCredentialRepo;
        const verifier = yield* CredentialVerifier;
        return yield* withAuth((session) =>
          route.handler(request, url, accountRepo, credentialRepo, verifier, session.userId),
        )(request);
      }),
    ),
}));
