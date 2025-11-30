/** Binance Chart Data Provider - OHLCV kline data */

import { Effect, Context, Layer, Cache } from "effect";
import type { ChartDataPoint } from "@0xsignal/shared";
import { DataSourceError } from "../types";
import { API_URLS, CACHE_TTL, CACHE_CAPACITY, BINANCE_INTERVALS } from "../../config/app.config";
import { HttpClientTag } from "../../http/client";

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

const toChartPoint = (kline: any[]): ChartDataPoint => ({
  time: Math.floor(kline[0] / 1000),
  open: parseFloat(kline[1]),
  high: parseFloat(kline[2]),
  low: parseFloat(kline[3]),
  close: parseFloat(kline[4]),
  volume: parseFloat(kline[5]),
});

export const ChartDataServiceLive = Layer.effect(
  ChartDataServiceTag,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;

    const cache = yield* Cache.make({
      capacity: CACHE_CAPACITY.DEFAULT,
      timeToLive: CACHE_TTL.BINANCE_CHART,
      lookup: (key: string) =>
        Effect.gen(function* () {
          const [symbol, interval, limitStr] = key.split(":");
          const binanceInterval = BINANCE_INTERVALS[interval] || "1h";
          const url = `${API_URLS.BINANCE}/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limitStr}`;
          const data = yield* http
            .getJson(url)
            .pipe(
              Effect.mapError(
                (e) => new DataSourceError({ source: "Binance", message: e.message, symbol })
              )
            );
          return (data as any[]).map(toChartPoint);
        }),
    });

    return {
      getHistoricalData: (symbol, interval, limit) => cache.get(`${symbol}:${interval}:${limit}`),
    };
  })
);
