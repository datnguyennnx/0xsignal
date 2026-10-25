import { Effect } from "effect";
import { withAuth } from "@0xsignal/auth";
import { OrderIntentService } from "../../modules/exchange";
import { buildIntentRoutes } from "../../modules/exchange/intent-http";
import { json } from "../../platform/http/error-response";
import type { Route } from "../../platform/http/route-contracts";
import type { HttpRequestServices } from "../contracts";
import { withDefectGuard } from "../defect-guard";
import { mapServiceError } from "../error-mapping";

export const exchangeRoutes: ReadonlyArray<Route<HttpRequestServices>> = buildIntentRoutes({
  json,
  mapServiceError,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request, url) =>
    withDefectGuard(
      Effect.gen(function* () {
        const intents = yield* OrderIntentService;
        return yield* withAuth((session) => route.handler(request, url, intents, session.userId))(
          request,
        );
      }),
    ),
}));
