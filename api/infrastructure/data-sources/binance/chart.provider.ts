/**
 * Binance Chart Data Provider
 * Fetches OHLCV kline data from Binance API
 */

import { Effect, Context, Layer, Cache } from "effect";
import { DataSourceError } from "../types";
import { API_URLS, CACHE_TTL, CACHE_CAPACITY, BINANCE_INTERVALS } from "../../config/app.config";

// Domain types for chart data
export interface ChartDataPoint {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

// Service interface
export interface ChartDataService {
  readonly getHistoricalData: (
    symbol: string,
    interval: string,
    limit: number
  ) => Effect.Effect<ChartDataPoint[], DataSourceError>;
}

export class ChartDataServiceTag extends Context.Tag("ChartDataService")<
  ChartDataServiceTag,
  ChartDataService
>() {}

// Transform raw Binance kline to ChartDataPoint
const toChartDataPoint = (kline: any[]): ChartDataPoint => ({
  time: Math.floor(kline[0] / 1000),
  open: parseFloat(kline[1]),
  high: parseFloat(kline[2]),
  low: parseFloat(kline[3]),
  close: parseFloat(kline[4]),
  volume: parseFloat(kline[5]),
});

// Service implementation with caching
export const ChartDataServiceLive = Layer.effect(
  ChartDataServiceTag,
  Effect.gen(function* () {
    // Cache key: "symbol:interval:limit"
    const chartCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.DEFAULT,
      timeToLive: CACHE_TTL.BINANCE_CHART,
      lookup: (key: string) =>
        Effect.gen(function* () {
          const [symbol, interval, limitStr] = key.split(":");
          const limit = parseInt(limitStr, 10);
          const binanceInterval = BINANCE_INTERVALS[interval] || "1h";

          const url = `${API_URLS.BINANCE}/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;

          const result = yield* Effect.tryPromise({
            try: async () => {
              const response = await fetch(url);
              if (!response.ok) {
                throw new Error(`Binance API error: ${response.statusText}`);
              }
              return (await response.json()) as any[];
            },
            catch: (error) =>
              new DataSourceError({
                source: "Binance",
                message: `Failed to fetch chart data: ${error}`,
                symbol,
              }),
          });

          return result.map(toChartDataPoint);
        }),
    });

    return {
      getHistoricalData: (symbol: string, interval: string, limit: number) =>
        chartCache.get(`${symbol}:${interval}:${limit}`),
    };
  })
);
