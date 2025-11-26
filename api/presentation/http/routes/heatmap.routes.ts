/**
 * Heatmap Routes
 * API endpoints for market heatmap and derivatives data
 */

import { Effect } from "effect";
import type { HeatmapConfig } from "@0xsignal/shared";
import { AggregatedDataServiceTag } from "../../../infrastructure/data-sources/aggregator";

/**
 * @openapi
 * /heatmap:
 *   get:
 *     tags:
 *       - Heatmap
 *     summary: Get market heatmap
 *     description: Returns market heatmap data for visualization
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 100
 *         description: Number of assets to include
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Layer 1, Layer 2, DeFi, Meme, Oracle, Exchange, Payment, Storage, AI, Other]
 *         description: Filter by category
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [marketCap, volume, change]
 *           default: marketCap
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Market heatmap data
 */
export const marketHeatmapRoute = (config: Partial<HeatmapConfig> = {}) =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    const fullConfig: HeatmapConfig = {
      metric: config.metric || "change24h",
      limit: Math.min(config.limit || 100, 200),
      category: config.category,
      sortBy: config.sortBy || "marketCap",
    };
    return yield* dataService.getMarketHeatmap(fullConfig);
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

/**
 * @openapi
 * /heatmap/movers:
 *   get:
 *     tags:
 *       - Heatmap
 *     summary: Get top movers heatmap
 *     description: Returns heatmap sorted by absolute price change
 */
export const topMoversHeatmapRoute = (limit: number = 50) =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getMarketHeatmap({
      metric: "change24h",
      limit: Math.min(limit, 100),
      sortBy: "change",
    });
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

/**
 * @openapi
 * /derivatives/open-interest:
 *   get:
 *     tags:
 *       - Derivatives
 *     summary: Get top open interest
 */
export const topOpenInterestRoute = (limit: number = 20) =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return yield* dataService.getTopOpenInterest(Math.min(limit, 50));
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

/**
 * @openapi
 * /derivatives/{symbol}/open-interest:
 *   get:
 *     tags:
 *       - Derivatives
 *     summary: Get open interest for a specific symbol
 */
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

/**
 * @openapi
 * /derivatives/{symbol}/funding-rate:
 *   get:
 *     tags:
 *       - Derivatives
 *     summary: Get funding rate for a specific symbol
 */
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

/**
 * @openapi
 * /sources:
 *   get:
 *     tags:
 *       - System
 *     summary: Get data sources information
 */
export const dataSourcesRoute = () =>
  Effect.gen(function* () {
    const dataService = yield* AggregatedDataServiceTag;
    return dataService.getSources();
  });
