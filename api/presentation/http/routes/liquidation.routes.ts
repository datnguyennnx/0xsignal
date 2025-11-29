/** Liquidation Routes */

import { Effect } from "effect";
import type { LiquidationTimeframe } from "@0xsignal/shared";
import { AggregatedDataServiceTag } from "../../../infrastructure/data-sources/aggregator";

const handleError = (e: { message: string; symbol?: string }) =>
  Effect.fail({ status: e.symbol ? 404 : 500, message: e.message });

export const marketLiquidationSummaryRoute = () =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getMarketLiquidationSummary()).pipe(
    Effect.catchTag("DataSourceError", handleError)
  );

export const symbolLiquidationRoute = (symbol: string, timeframe: LiquidationTimeframe = "24h") =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getLiquidations(symbol, timeframe)).pipe(
    Effect.catchTag("DataSourceError", handleError)
  );

export const liquidationHeatmapRoute = (symbol: string) =>
  Effect.flatMap(AggregatedDataServiceTag, (s) => s.getLiquidationHeatmap(symbol)).pipe(
    Effect.catchTag("DataSourceError", handleError)
  );
