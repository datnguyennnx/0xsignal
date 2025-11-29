/** Liquidations Use Case - Fetch liquidation data */

import { Effect } from "effect";
import type {
  LiquidationData,
  LiquidationHeatmap,
  MarketLiquidationSummary,
  LiquidationTimeframe,
} from "@0xsignal/shared";
import { AggregatedDataServiceTag } from "../infrastructure/data-sources/aggregator";
import { DataSourceError } from "../infrastructure/data-sources/types";

export const getLiquidations = (symbol: string, timeframe: LiquidationTimeframe = "24h") =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getLiquidations(symbol, timeframe));

export const getLiquidationHeatmap = (symbol: string) =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getLiquidationHeatmap(symbol));

export const getMarketLiquidationSummary = () =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getMarketLiquidationSummary());

export const getMultipleLiquidations = (
  symbols: readonly string[],
  timeframe: LiquidationTimeframe = "24h"
): Effect.Effect<LiquidationData[], DataSourceError, AggregatedDataServiceTag> =>
  Effect.flatMap(AggregatedDataServiceTag, (s) =>
    Effect.forEach(
      symbols,
      (symbol) =>
        s.getLiquidations(symbol, timeframe).pipe(Effect.catchAll(() => Effect.succeed(null))),
      { concurrency: 5 }
    ).pipe(Effect.map((results) => results.filter((r): r is LiquidationData => r !== null)))
  );
