import { Effect, Context, Layer, Cache, Duration } from "effect";
import { HttpClientTag } from "../../http/client";
import { DataSourceError, type AdapterInfo } from "../types";
import { API_URLS } from "../../config/app.config";
import type { ChartDataPoint } from "@0xsignal/shared";

const CHART_INFO: AdapterInfo = {
  name: "BinanceCharts",
  version: "1.0.0",
  capabilities: {
    spotPrices: false,
    futuresPrices: true,
    historicalData: true,
    realtime: false,
    liquidations: false,
    openInterest: false,
    fundingRates: false,
    heatmap: false,
  },
  rateLimit: { requestsPerMinute: 2400 },
};

export interface ChartDataClient {
  readonly info: AdapterInfo;
  readonly getHistoricalData: (
    symbol: string,
    interval: string,
    limit?: number
  ) => Effect.Effect<ChartDataPoint[], DataSourceError>;
}

export class ChartDataService extends Context.Tag("ChartDataService")<
  ChartDataService,
  ChartDataClient
>() {}

export const ChartDataServiceLive = Layer.effect(
  ChartDataService,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;

    const mapError = (e: unknown, symbol?: string) =>
      new DataSourceError({
        source: "BinanceCharts",
        message: e instanceof Error ? e.message : "Unknown error",
        symbol,
      });

    // Cache chart data to avoid hitting limits
    const chartCache = yield* Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(2),
      lookup: (key: string) => {
        const [symbol, interval, limitStr] = key.split(":");
        const limit = parseInt(limitStr);

        return http
          .getJson(
            `${API_URLS.BINANCE_FUTURES}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
          )
          .pipe(
            Effect.map((data: unknown) => {
              if (!Array.isArray(data)) return [];
              return data.map((d: any[]) => ({
                timestamp: new Date(d[0]),
                time: d[0],
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5]),
              }));
            }),
            Effect.mapError((e) => mapError(e, symbol))
          );
      },
    });

    return {
      info: CHART_INFO,
      getHistoricalData: (symbol: string, interval: string, limit: number = 100) =>
        chartCache.get(`${symbol}:${interval}:${limit}`),
    };
  })
);
