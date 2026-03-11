/** Hyperliquid Chart Provider - OHLCV candlestick data */

import { Effect, Context, Layer, Cache, Duration, Schema } from "effect";
import { HttpClientTag } from "../../http/client";
import { DataSourceError, type AdapterInfo } from "../types";
import { API_URLS } from "../../config/app.config";
import type { ChartDataPoint } from "@0xsignal/shared";
import { HyperliquidCandleSchema } from "../../http/schemas";

const HYPERLIQUID_INFO: AdapterInfo = {
  name: "Hyperliquid",
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
  rateLimit: { requestsPerMinute: 1200 },
};

// Interval mapping from our format to Hyperliquid format
const INTERVAL_MAP: Record<string, string> = {
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "2h": "2h",
  "4h": "4h",
  "8h": "8h",
  "12h": "12h",
  "1d": "1d",
  "3d": "3d",
  "1w": "1w",
  "1M": "1M",
};

export interface HyperliquidChartClient {
  readonly info: AdapterInfo;
  readonly getHistoricalData: (
    symbol: string,
    interval: string,
    limit?: number
  ) => Effect.Effect<ChartDataPoint[], DataSourceError>;
}

export class HyperliquidChartService extends Context.Tag("HyperliquidChartService")<
  HyperliquidChartService,
  HyperliquidChartClient
>() {}

// Calculate time range based on interval and limit
const calculateTimeRange = (
  interval: string,
  limit: number
): { startTime: number; endTime: number } => {
  const now = Date.now();
  const intervalMs = getIntervalMilliseconds(interval);
  const startTime = now - limit * intervalMs;
  return { startTime, endTime: now };
};

const getIntervalMilliseconds = (interval: string): number => {
  const value = parseInt(interval);
  const unit = interval.slice(-1);

  switch (unit) {
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "w":
      return value * 7 * 24 * 60 * 60 * 1000;
    case "M":
      return value * 30 * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000; // Default to 1h
  }
};

// Normalize symbol for Hyperliquid (remove USDT suffix)
const normalizeSymbol = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  if (upper.endsWith("USDT")) {
    return upper.slice(0, -4);
  }
  return upper;
};

// Schema for array of candles
const HyperliquidCandlesSchema = Schema.Array(HyperliquidCandleSchema);

export const HyperliquidChartServiceLive = Layer.effect(
  HyperliquidChartService,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;

    const mapError = (e: unknown, symbol?: string) =>
      new DataSourceError({
        source: "Hyperliquid",
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
        const hlSymbol = normalizeSymbol(symbol);
        const hlInterval = INTERVAL_MAP[interval] || "1h";
        const { startTime, endTime } = calculateTimeRange(interval, limit);

        const requestBody = {
          type: "candleSnapshot",
          req: {
            coin: hlSymbol,
            interval: hlInterval,
            startTime,
            endTime,
          },
        };

        return http
          .post(`${API_URLS.HYPERLIQUID}/info`, requestBody, HyperliquidCandlesSchema)
          .pipe(
            Effect.timeout(Duration.seconds(5)),
            Effect.map((candles) => {
              // Sort by time ascending
              const sorted = [...candles].sort((a, b) => a.t - b.t);

              // Take the most recent 'limit' candles
              const recent = sorted.slice(-limit);

              // Map to ChartDataPoint format
              return recent.map((candle) => ({
                time: Math.floor(candle.t / 1000), // Convert ms to seconds
                open: parseFloat(candle.o),
                high: parseFloat(candle.h),
                low: parseFloat(candle.l),
                close: parseFloat(candle.c),
                volume: parseFloat(candle.v),
              }));
            }),
            Effect.mapError((e) => mapError(e, symbol))
          );
      },
    });

    return {
      info: HYPERLIQUID_INFO,
      getHistoricalData: (symbol: string, interval: string, limit: number = 100) =>
        chartCache.get(`${symbol}:${interval}:${limit}`),
    };
  })
);
