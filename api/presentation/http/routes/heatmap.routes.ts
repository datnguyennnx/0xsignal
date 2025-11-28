import { Effect } from "effect";
import type { HeatmapConfig } from "@0xsignal/shared";
import { AggregatedDataServiceTag } from "../../../infrastructure/data-sources/aggregator";
import { DEFAULT_LIMITS } from "../../../infrastructure/config/app.config";

export const marketHeatmapRoute = (config: Partial<HeatmapConfig> = {}) =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    const fullConfig: HeatmapConfig = {
      metric: config.metric || "change24h",
      limit: Math.min(config.limit || DEFAULT_LIMITS.HEATMAP, DEFAULT_LIMITS.MAX_HEATMAP),
      category: config.category,
      sortBy: config.sortBy || "marketCap",
    };
    return yield* dataService.getMarketHeatmap(fullConfig);
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

export const topMoversHeatmapRoute = (limit: number = 50) =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getMarketHeatmap({
      metric: "change24h",
      limit: Math.min(limit, DEFAULT_LIMITS.HEATMAP),
      sortBy: "change",
    });
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

export const topOpenInterestRoute = (limit: number = DEFAULT_LIMITS.OPEN_INTEREST) =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getTopOpenInterest(Math.min(limit, 50));
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

export const symbolOpenInterestRoute = (symbol: string) =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getOpenInterest(symbol);
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({
        status: error.symbol ? 404 : 500,
        message: error.message,
      })
    )
  );

export const symbolFundingRateRoute = (symbol: string) =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getFundingRate(symbol);
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({
        status: error.symbol ? 404 : 500,
        message: error.message,
      })
    )
  );

export const dataSourcesRoute = () =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return dataService.getSources();
  });
