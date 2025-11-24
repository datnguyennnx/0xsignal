import { Effect } from "effect";
import { ChartDataServiceTag } from "../../../application/stream-chart-data";

/**
 * @openapi
 * /chart:
 *   get:
 *     tags:
 *       - Chart
 *     summary: Get historical chart data
 *     description: Returns OHLCV candlestick data for a cryptocurrency
 *     parameters:
 *       - in: query
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptocurrency symbol (e.g., BTCUSDT)
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w]
 *           default: 1h
 *         description: Candlestick interval
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 1M, 1y]
 *           default: 24h
 *         description: Time range to fetch
 *     responses:
 *       200:
 *         description: Chart data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChartDataPoint'
 *       400:
 *         description: Missing required parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const chartDataRoute = (symbol: string, interval: string, timeframe: string) => {
  // Calculate limit based on timeframe and interval
  const limitMap: Record<string, Record<string, number>> = {
    "24h": { "1m": 1440, "5m": 288, "15m": 96, "30m": 48, "1h": 24 },
    "7d": { "15m": 672, "30m": 336, "1h": 168, "4h": 42 },
    "1M": { "1h": 720, "4h": 180, "1d": 30 },
    "1y": { "1d": 365, "1w": 52 },
  };

  const limit = limitMap[timeframe]?.[interval] || 100;

  return Effect.gen(function* () {
    const service = yield* ChartDataServiceTag;
    return yield* service.getHistoricalData(symbol.toUpperCase(), interval, limit);
  });
};
