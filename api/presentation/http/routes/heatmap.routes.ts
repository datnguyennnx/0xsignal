/** Heatmap Routes */

import { Effect } from "effect";
import type { HeatmapConfig } from "@0xsignal/shared";
import { AggregatedDataServiceTag } from "../../../infrastructure/data-sources/aggregator";
import { DEFAULT_LIMITS } from "../../../infrastructure/config/app.config";

const handleError = (e: { message: string; symbol?: string }) =>
  Effect.fail({ status: e.symbol ? 404 : 500, message: e.message });

export const marketHeatmapRoute = (config: Partial<HeatmapConfig> = {}) =>
  Effect.flatMap(AggregatedDataServiceTag, (s) =>
    s.getMarketHeatmap({
      metric: config.metric || "change24h",
      limit: Math.min(config.limit || DEFAULT_LIMITS.HEATMAP, DEFAULT_LIMITS.MAX_HEATMAP),
      category: config.category,
      sortBy: config.sortBy || "marketCap",
    })
  ).pipe(Effect.catchTag("DataSourceError", handleError));

export const topMoversHeatmapRoute = (limit = 50) =>
  Effect.flatMap(AggregatedDataServiceTag, (s) =>
    s.getMarketHeatmap({
      metric: "change24h",
      limit: Math.min(limit, DEFAULT_LIMITS.HEATMAP),
      sortBy: "change",
    })
  ).pipe(Effect.catchTag("DataSourceError", handleError));

export const topOpenInterestRoute = (limit: number = DEFAULT_LIMITS.OPEN_INTEREST) =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getTopOpenInterest(Math.min(limit, 50))).pipe(
    Effect.catchTag("DataSourceError", handleError)
  );

export const symbolOpenInterestRoute = (symbol: string) =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getOpenInterest(symbol)).pipe(
    Effect.catchTag("DataSourceError", handleError)
  );

export const symbolFundingRateRoute = (symbol: string) =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getFundingRate(symbol)).pipe(
    Effect.catchTag("DataSourceError", handleError)
  );

export const dataSourcesRoute = () => Effect.map(AggregatedDataServiceTag, (s) => s.getSources());
