import { Effect } from "effect";
import { withAuth } from "@0xsignal/auth";
import { ExchangeService } from "../../modules/exchange";
import { buildExchangeRoutes } from "../../modules/exchange/http";
import { json } from "../../platform/http/error-response";
import type { Route } from "../../platform/http/route-contracts";
import type { HttpRequestServices } from "../contracts";
import { withDefectGuard } from "../defect-guard";
import { mapServiceError } from "../error-mapping";

export const exchangeRoutes: ReadonlyArray<Route<HttpRequestServices>> = buildExchangeRoutes({
  json,
  mapServiceError,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request, url) =>
    withDefectGuard(
      Effect.gen(function* () {
        const exchange = yield* ExchangeService;
        return yield* withAuth((session) => route.handler(request, url, exchange, session.userId))(
          request,
        );
      }),
    ),
}));
