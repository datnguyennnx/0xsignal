/**
 * Binance Provider - Futures data with BULK fetching
 * IMPORTANT: Liquidation data is ESTIMATED based on Open Interest and volatility.
 * This is NOT real liquidation tape data. Use for risk assessment only.
 */

import { Effect, Context, Layer, Duration, Option, Cache, Array as Arr, pipe } from "effect";
import type { OpenInterestData, FundingRateData } from "@0xsignal/shared";
import { HttpClientTag } from "../../http/client";
import {
  BinanceOpenInterestSchema,
  BinanceTickerSchema,
  BinancePremiumIndexSchema,
} from "../../http/schemas";
import { DataSourceError, type AdapterInfo } from "../types";
import { Schema } from "effect";

const FUTURES_BASE = "https://fapi.binance.com/fapi/v1";

const stripUsdt = (s: string) => s.replace("USDT", "");
const normalizeSymbol = (s: string) => {
  const upper = s.toUpperCase();
  return upper.endsWith("USDT") ? upper : `${upper}USDT`;
};

const mapError = (e: unknown, symbol?: string): DataSourceError =>
  new DataSourceError({
    source: "Binance",
    message: e instanceof Error ? e.message : "Unknown error",
    symbol,
  });

export const BINANCE_INFO: AdapterInfo = {
  name: "Binance",
  version: "2.0.0", // Upgraded for bulk fetching
  capabilities: {
    spotPrices: true,
    futuresPrices: true,

    openInterest: true,
    fundingRates: true,
    heatmap: false,
    historicalData: true,
    realtime: true,
  },
  rateLimit: { requestsPerMinute: 1200 },
};

// Schema for bulk ticker response (array of tickers)
const BulkTickerSchema = Schema.Array(BinanceTickerSchema);

export class BinanceService extends Context.Tag("BinanceService")<
  BinanceService,
  {
    readonly info: AdapterInfo;

    readonly getOpenInterest: (symbol: string) => Effect.Effect<OpenInterestData, DataSourceError>;
    readonly getFundingRate: (symbol: string) => Effect.Effect<FundingRateData, DataSourceError>;
    readonly getTopOpenInterest: (
      limit?: number
    ) => Effect.Effect<OpenInterestData[], DataSourceError>;
  }
>() {}

export const BinanceServiceLive = Layer.effect(
  BinanceService,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;

    // OPTIMIZATION: Bulk fetch ALL tickers in ONE request
    // This replaces the N+1 fetching pattern
    const bulkTickerCache = yield* Cache.make({
      capacity: 1,
      timeToLive: Duration.minutes(1), // Short TTL for fresh data
      lookup: (_: "all") =>
        http.get(`${FUTURES_BASE}/ticker/24hr`, BulkTickerSchema).pipe(
          Effect.map((tickers) =>
            pipe(
              tickers,
              Arr.filter((t) => t.symbol.endsWith("USDT")),
              Arr.map((t) => ({
                symbol: stripUsdt(t.symbol),
                price: parseFloat(t.lastPrice),
                volume: parseFloat(t.quoteVolume),
                change24h: parseFloat(t.priceChange),
                changePercent24h: parseFloat(t.priceChangePercent),
                high: parseFloat(t.highPrice),
                low: parseFloat(t.lowPrice),
              }))
            )
          ),
          Effect.mapError(mapError)
        ),
    });

    // Helper to get ticker from bulk cache
    const getTickerFromBulk = (symbol: string) =>
      bulkTickerCache.get("all").pipe(
        Effect.flatMap((tickers) =>
          pipe(
            tickers,
            Arr.findFirst((t) => t.symbol === stripUsdt(normalizeSymbol(symbol))),
            Option.match({
              onNone: () => Effect.fail(mapError(new Error("Symbol not found"), symbol)),
              onSome: Effect.succeed,
            })
          )
        )
      );

    // Single OI fetch (still needed per-symbol, but cached)
    const oiCache = yield* Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(2),
      lookup: (symbol: string) =>
        Effect.all({
          oi: http.get(
            `${FUTURES_BASE}/openInterest?symbol=${normalizeSymbol(symbol)}`,
            BinanceOpenInterestSchema
          ),
          ticker: getTickerFromBulk(symbol), // Uses bulk cache!
        }).pipe(
          Effect.map(({ oi, ticker }) => {
            const openInterest = parseFloat(oi.openInterest);
            return {
              symbol: ticker.symbol,
              openInterest,
              openInterestUsd: openInterest * ticker.price,
              change24h: ticker.change24h,
              changePercent24h: ticker.changePercent24h,
              timestamp: new Date(oi.time),
            } as OpenInterestData;
          }),
          Effect.mapError((e) => mapError(e, symbol))
        ),
    });

    // Funding Rate cache
    const fundingCache = yield* Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(5),
      lookup: (symbol: string) =>
        http
          .get(
            `${FUTURES_BASE}/premiumIndex?symbol=${normalizeSymbol(symbol)}`,
            BinancePremiumIndexSchema
          )
          .pipe(
            Effect.map(
              (d) =>
                ({
                  symbol: stripUsdt(normalizeSymbol(symbol)),
                  fundingRate: parseFloat(d.lastFundingRate) * 100,
                  nextFundingTime: new Date(d.nextFundingTime),
                  predictedRate: parseFloat(d.lastFundingRate) * 100,
                  timestamp: new Date(d.time),
                }) as FundingRateData
            ),
            Effect.mapError((e) => mapError(e, symbol))
          ),
    });

    // OPTIMIZED: Top OI using bulk ticker + parallel OI fetches
    const topOICache = yield* Cache.make({
      capacity: 10,
      timeToLive: Duration.minutes(2),
      lookup: (limit: number) =>
        Effect.gen(function* () {
          // Step 1: Get all tickers (ONE request)
          const allTickers = yield* bulkTickerCache.get("all");

          // Step 2: Sort by volume to find top symbols
          const topSymbols = pipe(
            allTickers,
            Arr.sortBy((a, b) => (b.volume > a.volume ? 1 : -1)),
            Arr.take(Math.min(limit * 2, 50)),
            Arr.map((t) => t.symbol)
          );

          // Step 3: Fetch OI for top symbols (parallel, cached)
          const results = yield* Effect.forEach(
            topSymbols,
            (s) => oiCache.get(s).pipe(Effect.option),
            { concurrency: 10 }
          );

          return pipe(
            results,
            Arr.filterMap((o) => (Option.isSome(o) ? Option.some(o.value) : Option.none())),
            Arr.sortBy((a, b) => (b.openInterestUsd > a.openInterestUsd ? 1 : -1)),
            Arr.take(limit)
          );
        }),
    });

    return {
      info: BINANCE_INFO,

      getOpenInterest: (symbol) => oiCache.get(symbol),
      getFundingRate: (symbol) => fundingCache.get(symbol),
      getTopOpenInterest: (limit = 20) => topOICache.get(limit),
    };
  })
);
