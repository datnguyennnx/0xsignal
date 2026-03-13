/** HTTP Router - Route matching with functional patterns */

import { Effect } from "effect";
import { healthRoute } from "./routes/health.routes";
import { globalMarketRoute } from "./routes/global-market.routes";
import { AggregatedDataServiceTag } from "../../infrastructure/data-sources/aggregator";

// Helpers
const getParam = (url: URL, key: string, def: string) => url.searchParams.get(key) || def;
const getInt = (url: URL, key: string, def: number, max?: number) => {
  const v = parseInt(getParam(url, key, String(def)));
  return max ? Math.min(v, max) : v;
};
const notFound = Effect.fail({ status: 404, message: "Not found" });
const badRequest = (msg: string) => Effect.fail({ status: 400, message: msg });
const methodNotAllowed = (method: string) =>
  Effect.fail({ status: 405, message: `Method ${method} not allowed` });

// Simple price route using AggregatedDataService
const pricesRoute = (limit: number) =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getTopCryptos(limit));

const priceBySymbolRoute = (symbol: string) =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getPrice(symbol));

// Main router - returns Effect with any requirements
export const handleRequest = (url: URL, method: string, body?: unknown) => {
  const path = url.pathname;

  // Static routes
  switch (path) {
    case "/api/health":
      return healthRoute();
    case "/api/global":
      return globalMarketRoute();
    case "/api/prices":
      return pricesRoute(getInt(url, "limit", 100, 250));
  }

  // Dynamic routes - price by symbol
  if (path.startsWith("/api/prices/")) {
    const symbol = path.replace("/api/prices/", "");
    return priceBySymbolRoute(symbol);
  }

  return notFound;
};
