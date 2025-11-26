/**
 * Buyback Routes
 * API endpoints for protocol buyback signals
 */

import { Effect } from "effect";
import { BuybackServiceTag } from "../../../services/buyback";

/**
 * @openapi
 * /buyback/signals:
 *   get:
 *     tags:
 *       - Buyback
 *     summary: Get buyback signals
 *     description: Returns protocols with buyback programs sorted by buyback rate relative to market cap
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of protocols to return
 *     responses:
 *       200:
 *         description: Buyback signals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BuybackSignal'
 */
export const buybackSignalsRoute = (limit: number = 50) =>
  Effect.gen(function* () {
    const service = yield* BuybackServiceTag;
    const signals = yield* service.getBuybackSignals(limit);
    return signals;
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

/**
 * @openapi
 * /buyback/overview:
 *   get:
 *     tags:
 *       - Buyback
 *     summary: Get buyback market overview
 *     description: Returns aggregated buyback statistics across all protocols
 *     responses:
 *       200:
 *         description: Buyback overview
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BuybackOverview'
 */
export const buybackOverviewRoute = () =>
  Effect.gen(function* () {
    const service = yield* BuybackServiceTag;
    const overview = yield* service.getBuybackOverview();
    return overview;
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

/**
 * @openapi
 * /buyback/{protocol}:
 *   get:
 *     tags:
 *       - Buyback
 *     summary: Get buyback signal for specific protocol
 *     description: Returns buyback data for a specific protocol
 *     parameters:
 *       - in: path
 *         name: protocol
 *         required: true
 *         schema:
 *           type: string
 *         description: Protocol slug (e.g., "aave", "uniswap")
 *     responses:
 *       200:
 *         description: Protocol buyback signal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BuybackSignal'
 *       404:
 *         description: Protocol not found or no buyback data
 */
export const protocolBuybackRoute = (protocol: string) =>
  Effect.gen(function* () {
    const service = yield* BuybackServiceTag;
    const signal = yield* service.getProtocolBuyback(protocol);

    if (!signal) {
      return yield* Effect.fail({ status: 404, message: `No buyback data for ${protocol}` });
    }

    return signal;
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

/**
 * @openapi
 * /buyback/{protocol}/detail:
 *   get:
 *     tags:
 *       - Buyback
 *     summary: Get detailed buyback data with historical chart
 *     description: Returns buyback data with daily revenue history for charting
 *     parameters:
 *       - in: path
 *         name: protocol
 *         required: true
 *         schema:
 *           type: string
 *         description: Protocol slug (e.g., "hyperliquid", "lido")
 *     responses:
 *       200:
 *         description: Protocol buyback detail with chart data
 *       404:
 *         description: Protocol not found
 */
export const protocolBuybackDetailRoute = (protocol: string) =>
  Effect.gen(function* () {
    const service = yield* BuybackServiceTag;
    const detail = yield* service.getProtocolBuybackDetail(protocol);

    if (!detail) {
      return yield* Effect.fail({ status: 404, message: `No buyback data for ${protocol}` });
    }

    return detail;
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );
