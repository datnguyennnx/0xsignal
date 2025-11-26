/**
 * Liquidation Routes
 * API endpoints for liquidation data
 */

import { Effect } from "effect";
import type { LiquidationTimeframe } from "@0xsignal/shared";
import { AggregatedDataServiceTag } from "../../../infrastructure/data-sources/aggregator";

/**
 * @openapi
 * /liquidations/summary:
 *   get:
 *     tags:
 *       - Liquidations
 *     summary: Get market-wide liquidation summary
 *     description: Returns aggregated liquidation data across all markets for the last 24 hours
 */
export const marketLiquidationSummaryRoute = () =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getMarketLiquidationSummary();
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

/**
 * @openapi
 * /liquidations/{symbol}:
 *   get:
 *     tags:
 *       - Liquidations
 *     summary: Get liquidation data for a specific symbol
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 4h, 12h, 24h]
 *           default: 24h
 */
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

/**
 * @openapi
 * /liquidations/{symbol}/heatmap:
 *   get:
 *     tags:
 *       - Liquidations
 *     summary: Get liquidation heatmap for a specific symbol
 */
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
