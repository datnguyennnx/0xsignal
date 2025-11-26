/**
 * Get Heatmap Use Case
 * Generates market heatmap data from aggregated sources
 */

import { Effect } from "effect";
import type {
  MarketHeatmap,
  HeatmapConfig,
  OpenInterestData,
  FundingRateData,
} from "@0xsignal/shared";
import { AggregatedDataServiceTag } from "../infrastructure/data-sources/aggregator";
import { DataSourceError } from "../infrastructure/data-sources/types";

const DEFAULT_CONFIG: HeatmapConfig = {
  metric: "change24h",
  limit: 100,
  sortBy: "marketCap",
};

export const getMarketHeatmap = (
  config: Partial<HeatmapConfig> = {}
): Effect.Effect<MarketHeatmap, DataSourceError, AggregatedDataServiceTag> =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    const fullConfig: HeatmapConfig = { ...DEFAULT_CONFIG, ...config };
    return yield* dataService.getMarketHeatmap(fullConfig);
  });

export const getCategoryHeatmap = (
  category: string,
  limit: number = 50
): Effect.Effect<MarketHeatmap, DataSourceError, AggregatedDataServiceTag> =>
  getMarketHeatmap({
    category,
    limit,
    sortBy: "marketCap",
  });

export const getTopMoversHeatmap = (
  limit: number = 50
): Effect.Effect<MarketHeatmap, DataSourceError, AggregatedDataServiceTag> =>
  getMarketHeatmap({
    limit,
    sortBy: "change",
  });

export const getOpenInterest = (
  symbol: string
): Effect.Effect<OpenInterestData, DataSourceError, AggregatedDataServiceTag> =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getOpenInterest(symbol);
  });

export const getFundingRate = (
  symbol: string
): Effect.Effect<FundingRateData, DataSourceError, AggregatedDataServiceTag> =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getFundingRate(symbol);
  });

export const getTopOpenInterest = (
  limit: number = 20
): Effect.Effect<OpenInterestData[], DataSourceError, AggregatedDataServiceTag> =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getTopOpenInterest(limit);
  });

export interface DerivativesOverview {
  readonly topOpenInterest: readonly OpenInterestData[];
  readonly timestamp: Date;
}

export const getDerivativesOverview = (
  limit: number = 20
): Effect.Effect<DerivativesOverview, DataSourceError, AggregatedDataServiceTag> =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    const topOI = yield* dataService.getTopOpenInterest(limit);

    return {
      topOpenInterest: topOI,
      timestamp: new Date(),
    };
  });
