/**
 * Get Liquidations Use Case
 * Fetches and processes liquidation data from aggregated sources
 */

import { Effect } from "effect";
import type {
  LiquidationData,
  LiquidationHeatmap,
  MarketLiquidationSummary,
  LiquidationTimeframe,
} from "@0xsignal/shared";
import { AggregatedDataServiceTag } from "../infrastructure/data-sources/aggregator";
import { DataSourceError } from "../infrastructure/data-sources/types";

export const getLiquidations = (
  symbol: string,
  timeframe: LiquidationTimeframe = "24h"
): Effect.Effect<LiquidationData, DataSourceError, AggregatedDataServiceTag> =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getLiquidations(symbol, timeframe);
  });

export const getLiquidationHeatmap = (
  symbol: string
): Effect.Effect<LiquidationHeatmap, DataSourceError, AggregatedDataServiceTag> =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getLiquidationHeatmap(symbol);
  });

export const getMarketLiquidationSummary = (): Effect.Effect<
  MarketLiquidationSummary,
  DataSourceError,
  AggregatedDataServiceTag
> =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getMarketLiquidationSummary();
  });

export const getMultipleLiquidations = (
  symbols: readonly string[],
  timeframe: LiquidationTimeframe = "24h"
): Effect.Effect<LiquidationData[], DataSourceError, AggregatedDataServiceTag> =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;

    const results = yield* Effect.forEach(
      symbols,
      (symbol) =>
        dataService
          .getLiquidations(symbol, timeframe)
          .pipe(Effect.catchAll(() => Effect.succeed(null))),
      { concurrency: 5 }
    );

    return results.filter((r): r is LiquidationData => r !== null);
  });
