import { Effect, Context, Layer, Cache, Duration } from "effect";
import { HttpClientTag } from "../../http/client";
import { DataSourceError, type AdapterInfo } from "../types";
import { API_URLS } from "../../config/app.config";
import { CoinGeckoService } from "../coingecko";
import type { ChartDataPoint } from "@0xsignal/shared";

const CHART_INFO: AdapterInfo = {
  name: "BinanceCharts",
  version: "1.0.0",
  capabilities: {
    spotPrices: false,
    futuresPrices: true,
    historicalData: true,
    realtime: false,

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
    const coinGecko = yield* CoinGeckoService;

    const mapError = (e: unknown, symbol?: string) =>
      new DataSourceError({
        source: "BinanceCharts",
        message: e instanceof Error ? e.message : "Unknown error",
        symbol,
      });

    // Cache chart data to avoid hitting limits
    const chartCache = yield* Cache.make({
      capacity: 500,
      timeToLive: Duration.minutes(5),
      lookup: (key: string) => {
        const [symbol, interval, limitStr] = key.split(":");
        const limit = parseInt(limitStr);

        return http
          .getJson(
            `${API_URLS.BINANCE_FUTURES}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
          )
          .pipe(
            Effect.timeout(Duration.seconds(3)),
            Effect.catchAll(() => Effect.succeed([])),
            Effect.flatMap((data: any) => {
              if (Array.isArray(data) && data.length > 0) return Effect.succeed(data);
              // Fallback 1: Binance Spot
              return http
                .getJson(
                  `${API_URLS.BINANCE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
                )
                .pipe(
                  Effect.timeout(Duration.seconds(3)),
                  Effect.catchAll(() => Effect.succeed([])),
                  Effect.flatMap((spotData: any) => {
                    if (Array.isArray(spotData) && spotData.length > 0)
                      return Effect.succeed(spotData);

                    // Fallback 2: CoinGecko (Slow, limited granularity)
                    return coinGecko.getCoinId(symbol).pipe(
                      Effect.flatMap((id) => {
                        if (!id) return Effect.succeed([]);
                        // CoinGecko limitation:
                        // days=1 -> 30m candles (good for '1h')
                        // days=30 -> 4h candles (good for '4h', '1d')
                        const days = interval === "1h" || interval.includes("m") ? "1" : "30";
                        return http
                          .getJson(
                            `${API_URLS.COINGECKO}/coins/${id}/ohlc?vs_currency=usd&days=${days}`
                          )
                          .pipe(
                            Effect.map((cgData: any) => {
                              if (!Array.isArray(cgData)) return [];
                              // CoinGecko format: [time, open, high, low, close]
                              // Convert to Binance-like format for consistency (though we return ChartDataPoint directly at end)
                              // Actually, let's map directly to ChartDataPoint structure here to match the final map?
                              // No, the downstream .map expects data.map(d => ...).
                              // CoinGecko structure is slightly different (no volume).
                              // Let's normalize it to the array format [time, open, high, low, close, volume] calling volume 0.
                              return cgData.map((d: any[]) => [d[0], d[1], d[2], d[3], d[4], 0]);
                            }),
                            Effect.catchAll(() => Effect.succeed([]))
                          );
                      })
                    );
                  })
                );
            }),
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
