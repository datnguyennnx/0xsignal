/** CoinGecko Historical Chart Provider - Fallback for non-Binance coins */

import { Effect, Context, Layer, Cache, Schema } from "effect";
import type { ChartDataPoint } from "@0xsignal/shared";
import { HttpClientTag } from "../../http/client";
import { DataSourceError } from "../types";
import { API_URLS, CACHE_TTL, CACHE_CAPACITY } from "../../config/app.config";

// CoinGecko OHLC response: [[timestamp, open, high, low, close], ...]
const OHLCSchema = Schema.Array(
  Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number, Schema.Number)
);

type OHLCResponse = typeof OHLCSchema.Type;

// CoinGecko market_chart for volume data
const MarketChartSchema = Schema.Struct({
  prices: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number)),
  total_volumes: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number)),
});

type MarketChartResponse = typeof MarketChartSchema.Type;

// Convert interval to days for CoinGecko OHLC
// CoinGecko OHLC supports: 1, 7, 14, 30, 90, 180, 365, max
const intervalToDays = (interval: string): string => {
  switch (interval) {
    case "1m":
    case "5m":
    case "15m":
    case "30m":
      return "1";
    case "1h":
      return "7";
    case "4h":
      return "30";
    case "1d":
      return "90";
    case "1w":
      return "365";
    default:
      return "7";
  }
};

// Transform CoinGecko OHLC to ChartDataPoint
const toChartPoints = (ohlc: OHLCResponse, volumeMap: Map<number, number>): ChartDataPoint[] => {
  return ohlc.map(([timestamp, open, high, low, close]) => {
    const time = Math.floor(timestamp / 1000);
    // Find closest volume data point
    const volume = findClosestVolume(time, volumeMap);
    return { time, open, high, low, close, volume };
  });
};

// Find volume for closest timestamp (within 1 hour tolerance)
const findClosestVolume = (time: number, volumeMap: Map<number, number>): number => {
  const direct = volumeMap.get(time);
  if (direct !== undefined) return direct;

  // Search within 1 hour window
  for (let offset = 0; offset <= 3600; offset += 60) {
    const before = volumeMap.get(time - offset);
    if (before !== undefined) return before;
    const after = volumeMap.get(time + offset);
    if (after !== undefined) return after;
  }
  return 0;
};

export interface CoinGeckoChartService {
  readonly getHistoricalChart: (
    coinId: string,
    interval: string,
    limit: number
  ) => Effect.Effect<ChartDataPoint[], DataSourceError>;
}

export class CoinGeckoChartServiceTag extends Context.Tag("CoinGeckoChartService")<
  CoinGeckoChartServiceTag,
  CoinGeckoChartService
>() {}

export const CoinGeckoChartServiceLive = Layer.effect(
  CoinGeckoChartServiceTag,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;

    const cache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.COINGECKO_HISTORICAL,
      lookup: (key: string) =>
        Effect.gen(function* () {
          const [coinId, interval] = key.split(":");
          const days = intervalToDays(interval);

          const ohlcUrl = `${API_URLS.COINGECKO}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
          const volumeUrl = `${API_URLS.COINGECKO}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;

          // Fetch OHLC and volume in parallel
          const [ohlcData, volumeData] = yield* Effect.all(
            [
              http.get(ohlcUrl, OHLCSchema).pipe(
                Effect.mapError(
                  (e) =>
                    new DataSourceError({
                      source: "CoinGecko",
                      message: e.message,
                      symbol: coinId,
                    })
                )
              ),
              http
                .get(volumeUrl, MarketChartSchema)
                .pipe(Effect.catchAll(() => Effect.succeed({ prices: [], total_volumes: [] }))),
            ],
            { concurrency: 2 }
          );

          // Build volume map
          const volumeMap = new Map(
            volumeData.total_volumes.map(([t, v]) => [Math.floor(t / 1000), v])
          );

          return toChartPoints(ohlcData, volumeMap);
        }),
    });

    return {
      getHistoricalChart: (coinId, interval, limit) => cache.get(`${coinId}:${interval}:${limit}`),
    };
  })
);
