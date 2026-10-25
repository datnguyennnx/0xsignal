import { Effect } from "effect";
import { MarketDataService } from "../../modules/market-data";
import { buildMarketDataRoutes } from "../../modules/market-data/http";
import { json } from "../../platform/http/error-response";
import type { Route } from "../../platform/http/route-contracts";
import type { HttpRequestServices } from "../contracts";
import { mapServiceError } from "../error-mapping";

export const marketDataRoutes: ReadonlyArray<Route<HttpRequestServices>> = buildMarketDataRoutes({
  json,
  mapServiceError,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request, url) =>
    Effect.gen(function* () {
      const marketData = yield* MarketDataService;
      return yield* route.handler(request, url, marketData);
    }),
}));
