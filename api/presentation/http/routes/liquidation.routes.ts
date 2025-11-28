import { Effect } from "effect";
import type { LiquidationTimeframe } from "@0xsignal/shared";
import { AggregatedDataServiceTag } from "../../../infrastructure/data-sources/aggregator";

export const marketLiquidationSummaryRoute = () =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getMarketLiquidationSummary();
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

export const symbolLiquidationRoute = (symbol: string, timeframe: LiquidationTimeframe = "24h") =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getLiquidations(symbol, timeframe);
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({
        status: error.symbol ? 404 : 500,
        message: error.message,
      })
    )
  );

export const liquidationHeatmapRoute = (symbol: string) =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getLiquidationHeatmap(symbol);
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({
        status: error.symbol ? 404 : 500,
        message: error.message,
      })
    )
  );
