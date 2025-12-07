/** HTTP Router - Route matching with functional patterns */

import { Effect, Option, pipe } from "effect";
import type { HeatmapConfig } from "@0xsignal/shared";
import { healthRoute } from "./routes/health.routes";
import {
  topAnalysisRoute,
  symbolAnalysisRoute,
  marketOverviewRoute,
} from "./routes/analysis.routes";
import { tradingSignalsRoute, highConfidenceSignalsRoute } from "./routes/signals.routes";
import { chartDataRoute } from "./routes/chart.routes";
import {
  marketHeatmapRoute,
  topMoversHeatmapRoute,
  topOpenInterestRoute,
  symbolOpenInterestRoute,
  symbolFundingRateRoute,
  dataSourcesRoute,
} from "./routes/heatmap.routes";

import {
  buybackSignalsRoute,
  buybackOverviewRoute,
  protocolBuybackRoute,
  protocolBuybackDetailRoute,
} from "./routes/buyback.routes";
import { globalMarketRoute } from "./routes/global-market.routes";
import {
  treasuryEntitiesRoute,
  treasuryHoldingsRoute,
  treasuryChartRoute,
  treasurySupportedCoinsRoute,
} from "./routes/treasury.routes";
import { assetContextRoute } from "./routes/context.routes";

// Helpers
const getParam = (url: URL, key: string, def: string) => url.searchParams.get(key) || def;
const getInt = (url: URL, key: string, def: number, max?: number) => {
  const v = parseInt(getParam(url, key, String(def)));
  return max ? Math.min(v, max) : v;
};
const notFound = Effect.fail({ status: 404, message: "Not found" });
const badRequest = (msg: string) => Effect.fail({ status: 400, message: msg });

// Route patterns
const patterns = {
  derivativesOI: /^\/api\/derivatives\/([^/]+)\/open-interest$/,
  derivativesFR: /^\/api\/derivatives\/([^/]+)\/funding-rate$/,
  buybackDetail: /^\/api\/buyback\/([^/]+)\/detail$/,
  buyback: /^\/api\/buyback\/([^/]+)$/,
  analysis: /^\/api\/analysis\/([^/]+)$/,
  treasuryHoldings: /^\/api\/treasury\/([^/]+)\/holdings$/,
  treasuryChart: /^\/api\/treasury\/([^/]+)\/chart$/,
  context: /^\/api\/context\/([^/]+)$/,
};

// Match pattern and extract param
const matchPattern = (path: string, pattern: RegExp): Option.Option<string> =>
  pipe(
    Option.fromNullable(path.match(pattern)),
    Option.filter((m) => m.length > 1),
    Option.map((m) => m[1])
  );

// Main router - returns Effect with any requirements
export const handleRequest = (url: URL, _method: string) => {
  const path = url.pathname;

  // Static routes
  switch (path) {
    case "/api/health":
      return healthRoute();
    case "/api/global":
      return globalMarketRoute();
    case "/api/analysis/top":
      return topAnalysisRoute(getInt(url, "limit", 20, 100));
    case "/api/overview":
      return marketOverviewRoute();
    case "/api/signals":
      return tradingSignalsRoute();
    case "/api/signals/high-confidence":
      return highConfidenceSignalsRoute(getInt(url, "confidence", 70));
    case "/api/heatmap/movers":
      return topMoversHeatmapRoute(getInt(url, "limit", 50));

    case "/api/derivatives/open-interest":
      return topOpenInterestRoute(getInt(url, "limit", 20));
    case "/api/sources":
      return dataSourcesRoute();
    case "/api/buyback/signals":
      return buybackSignalsRoute(getInt(url, "limit", 50, 100));
    case "/api/buyback/overview":
      return buybackOverviewRoute();
    case "/api/chart": {
      const symbol = url.searchParams.get("symbol");
      return symbol
        ? chartDataRoute(symbol, getParam(url, "interval", "1h"), getParam(url, "timeframe", "24h"))
        : badRequest("Symbol required");
    }
    case "/api/heatmap":
      return marketHeatmapRoute({
        limit: getInt(url, "limit", 100),
        category: getParam(url, "category", "") || undefined,
        sortBy: getParam(url, "sortBy", "marketCap") as HeatmapConfig["sortBy"],
      });
    case "/api/treasury/overview":
    case "/api/treasury/entities":
      return treasuryEntitiesRoute();
    case "/api/treasury/coins":
      return treasurySupportedCoinsRoute();
  }

  // Dynamic routes - derivatives OI
  const oiMatch = path.match(patterns.derivativesOI);
  if (oiMatch) return symbolOpenInterestRoute(oiMatch[1]);

  // Dynamic routes - derivatives FR
  const frMatch = path.match(patterns.derivativesFR);
  if (frMatch) return symbolFundingRateRoute(frMatch[1]);

  // Dynamic routes - buyback detail
  const buybackDetailMatch = path.match(patterns.buybackDetail);
  if (buybackDetailMatch) return protocolBuybackDetailRoute(buybackDetailMatch[1]);

  // Dynamic routes - buyback
  const buybackMatch = path.match(patterns.buyback);
  if (buybackMatch && !["signals", "overview"].some((s) => path.includes(s))) {
    return protocolBuybackRoute(buybackMatch[1]);
  }

  // Dynamic routes - analysis
  const analysisMatch = path.match(patterns.analysis);
  if (analysisMatch && analysisMatch[1] !== "top") {
    return symbolAnalysisRoute(analysisMatch[1]);
  }

  // Dynamic routes - treasury holdings
  const treasuryHoldingsMatch = path.match(patterns.treasuryHoldings);
  if (treasuryHoldingsMatch) return treasuryHoldingsRoute(treasuryHoldingsMatch[1]);

  // Dynamic routes - treasury chart
  const treasuryChartMatch = path.match(patterns.treasuryChart);
  if (treasuryChartMatch) return treasuryChartRoute(treasuryChartMatch[1]);

  // Dynamic routes - unified context
  const contextMatch = path.match(patterns.context);
  if (contextMatch) {
    const includeTreasury = getParam(url, "treasury", "true") === "true";
    const includeDerivatives = getParam(url, "derivatives", "true") === "true";
    return assetContextRoute(contextMatch[1], {
      includeTreasury,
      includeDerivatives,
    });
  }

  return notFound;
};
