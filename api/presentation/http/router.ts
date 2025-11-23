import { Effect } from "effect";
import { healthRoute } from "./routes/health.routes";
import {
  topAnalysisRoute,
  symbolAnalysisRoute,
  marketOverviewRoute,
} from "./routes/analysis.routes";
import { tradingSignalsRoute, highConfidenceSignalsRoute } from "./routes/signals.routes";
import { chartDataRoute } from "./routes/chart.routes";

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

  // Single symbol analysis
  if (path.startsWith("/api/analysis/")) {
    const symbol = path.split("/").pop();
    if (symbol && symbol !== "top") {
      return symbolAnalysisRoute(symbol);
    }
  }

  // 404
  return Effect.fail({ status: 404, message: "Not found" });
};
