/**
 * HTTP Router
 * Routes all API requests to appropriate handlers
 */

import { Effect } from "effect";
import type { LiquidationTimeframe, HeatmapConfig } from "@0xsignal/shared";
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
  marketLiquidationSummaryRoute,
  symbolLiquidationRoute,
  liquidationHeatmapRoute,
} from "./routes/liquidation.routes";
import {
  buybackSignalsRoute,
  buybackOverviewRoute,
  protocolBuybackRoute,
  protocolBuybackDetailRoute,
} from "./routes/buyback.routes";

export const handleRequest = (url: URL, _method: string) => {
  const path = url.pathname;

  // Health check
  if (path === "/api/health") {
    return healthRoute();
  }

  // Top analysis
  if (path === "/api/analysis/top") {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    return topAnalysisRoute(limit);
  }

  // Market overview
  if (path === "/api/overview") {
    return marketOverviewRoute();
  }

  // Trading signals
  if (path === "/api/signals") {
    return tradingSignalsRoute();
  }

  // High confidence signals
  if (path === "/api/signals/high-confidence") {
    const minConfidence = parseInt(url.searchParams.get("confidence") || "70");
    return highConfidenceSignalsRoute(minConfidence);
  }

  // Chart data
  if (path === "/api/chart") {
    const symbol = url.searchParams.get("symbol");
    const interval = url.searchParams.get("interval") || "1h";
    const timeframe = url.searchParams.get("timeframe") || "24h";

    if (!symbol) {
      return Effect.fail({ status: 400, message: "Symbol parameter is required" });
    }

    return chartDataRoute(symbol, interval, timeframe);
  }

  // Market heatmap
  if (path === "/api/heatmap") {
    const config: Partial<HeatmapConfig> = {
      limit: parseInt(url.searchParams.get("limit") || "100"),
      category: url.searchParams.get("category") || undefined,
      sortBy: (url.searchParams.get("sortBy") as HeatmapConfig["sortBy"]) || "marketCap",
    };
    return marketHeatmapRoute(config);
  }

  // Top movers heatmap
  if (path === "/api/heatmap/movers") {
    const limit = parseInt(url.searchParams.get("limit") || "50");
    return topMoversHeatmapRoute(limit);
  }

  // Liquidation summary
  if (path === "/api/liquidations/summary") {
    return marketLiquidationSummaryRoute();
  }

  // Liquidation heatmap for symbol
  if (path.match(/^\/api\/liquidations\/[^/]+\/heatmap$/)) {
    const symbol = path.split("/")[3];
    return liquidationHeatmapRoute(symbol);
  }

  // Symbol liquidation
  if (path.match(/^\/api\/liquidations\/[^/]+$/) && !path.includes("summary")) {
    const symbol = path.split("/").pop()!;
    const timeframe = (url.searchParams.get("timeframe") || "24h") as LiquidationTimeframe;
    return symbolLiquidationRoute(symbol, timeframe);
  }

  // Top open interest
  if (path === "/api/derivatives/open-interest") {
    const limit = parseInt(url.searchParams.get("limit") || "20");
    return topOpenInterestRoute(limit);
  }

  // Symbol open interest
  if (path.match(/^\/api\/derivatives\/[^/]+\/open-interest$/)) {
    const symbol = path.split("/")[3];
    return symbolOpenInterestRoute(symbol);
  }

  // Symbol funding rate
  if (path.match(/^\/api\/derivatives\/[^/]+\/funding-rate$/)) {
    const symbol = path.split("/")[3];
    return symbolFundingRateRoute(symbol);
  }

  // Data sources
  if (path === "/api/sources") {
    return dataSourcesRoute();
  }

  // Buyback signals
  if (path === "/api/buyback/signals") {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    return buybackSignalsRoute(limit);
  }

  // Buyback overview
  if (path === "/api/buyback/overview") {
    return buybackOverviewRoute();
  }

  // Protocol buyback detail (with chart data)
  if (path.match(/^\/api\/buyback\/[^/]+\/detail$/)) {
    const protocol = path.split("/")[3];
    return protocolBuybackDetailRoute(protocol);
  }

  // Protocol buyback (must be after other buyback routes)
  if (
    path.match(/^\/api\/buyback\/[^/]+$/) &&
    !path.includes("signals") &&
    !path.includes("overview")
  ) {
    const protocol = path.split("/").pop()!;
    return protocolBuybackRoute(protocol);
  }

  // Single symbol analysis (must be last to avoid matching other routes)
  if (path.startsWith("/api/analysis/")) {
    const symbol = path.split("/").pop();
    if (symbol && symbol !== "top") {
      return symbolAnalysisRoute(symbol);
    }
  }

  // 404
  return Effect.fail({ status: 404, message: "Not found" });
};
