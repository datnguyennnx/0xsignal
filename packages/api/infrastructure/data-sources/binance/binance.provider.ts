/**
 * Binance Provider - Futures data with BULK fetching
 * IMPORTANT: Liquidation data is ESTIMATED based on Open Interest and volatility.
 * This is NOT real liquidation tape data. Use for risk assessment only.
 */

import { Effect, Context, Layer, Duration, Option, Cache, Array as Arr, pipe } from "effect";
import type {
  LiquidationData,
  LiquidationHeatmap,
  LiquidationLevel,
  MarketLiquidationSummary,
  LiquidationTimeframe,
  OpenInterestData,
  FundingRateData,
} from "@0xsignal/shared";
import { HttpClientTag } from "../../http/client";
import {
  BinanceOpenInterestSchema,
  BinanceTickerSchema,
  BinancePremiumIndexSchema,
} from "../../http/schemas";
import { DataSourceError, type AdapterInfo } from "../types";
import { Schema } from "effect";

const FUTURES_BASE = "https://fapi.binance.com/fapi/v1";
const TIMEFRAME_HOURS: Record<LiquidationTimeframe, number> = {
  "1h": 1,
  "4h": 4,
  "12h": 12,
  "24h": 24,
};

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
    liquidations: true, // Note: These are ESTIMATES, not real liquidation tape
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
    readonly getLiquidations: (
      symbol: string,
      timeframe: LiquidationTimeframe
    ) => Effect.Effect<LiquidationData, DataSourceError>;
    readonly getLiquidationHeatmap: (
      symbol: string
    ) => Effect.Effect<LiquidationHeatmap, DataSourceError>;
    readonly getMarketLiquidationSummary: () => Effect.Effect<
      MarketLiquidationSummary,
      DataSourceError
    >;
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

    // Liquidations cache - CLEARLY MARKED AS ESTIMATES
    const liqCache = yield* Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(2),
      lookup: (key: string) => {
        const [symbol, timeframe] = key.split(":") as [string, LiquidationTimeframe];
        return Effect.all({
          oi: oiCache.get(symbol),
          ticker: getTickerFromBulk(symbol),
        }).pipe(
          Effect.map(({ oi, ticker }) => {
            // IMPORTANT: These are ESTIMATES based on OI and volatility
            // NOT real liquidation tape data
            const volatility = Math.min(Math.abs(ticker.changePercent24h) / 10, 1);
            const timeFactor = TIMEFRAME_HOURS[timeframe] / 24;
            const estLiqUsd = oi.openInterestUsd * 0.01 * volatility * timeFactor;
            const isUp = ticker.change24h > 0;
            const longRatio = isUp ? 0.3 : 0.7;
            const longUsd = estLiqUsd * longRatio;
            const shortUsd = estLiqUsd * (1 - longRatio);

            return {
              symbol: oi.symbol,
              longLiquidations: Math.round(longUsd / 25000),
              shortLiquidations: Math.round(shortUsd / 25000),
              totalLiquidations: Math.round(estLiqUsd / 25000),
              longLiquidationUsd: longUsd,
              shortLiquidationUsd: shortUsd,
              totalLiquidationUsd: estLiqUsd,
              liquidationRatio: shortUsd > 0 ? longUsd / shortUsd : 0,
              timestamp: new Date(),
              timeframe,
              // Mark as estimate for transparency
              isEstimate: true,
            } as LiquidationData;
          }),
          Effect.mapError((e) => mapError(e, symbol))
        );
      },
    });

    // Heatmap cache - uses bulk ticker
    const heatmapCache = yield* Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(2),
      lookup: (symbol: string) =>
        getTickerFromBulk(symbol).pipe(
          Effect.map((ticker) => {
            const { price, high, low, volume } = ticker;
            const range = high - low;
            const bucket = range / 10;
            const levels: LiquidationLevel[] = Array.from({ length: 10 }, (_, i) => {
              const p = low + bucket * i + bucket / 2;
              const dist = Math.abs(p - price) / price;
              const prox = Math.max(0, 1 - dist * 5);
              const baseUsd = volume * 0.001 * prox;
              const isAbove = p > price;
              return {
                price: Math.round(p * 100) / 100,
                longLiquidationUsd: isAbove ? baseUsd * 0.3 : baseUsd * 0.7,
                shortLiquidationUsd: isAbove ? baseUsd * 0.7 : baseUsd * 0.3,
                totalUsd: baseUsd,
                intensity: prox * 100,
              };
            });
            return {
              symbol: ticker.symbol,
              levels,
              currentPrice: price,
              highestLiquidationPrice: high,
              lowestLiquidationPrice: low,
              totalLongLiquidationUsd: levels.reduce((s, l) => s + l.longLiquidationUsd, 0),
              totalShortLiquidationUsd: levels.reduce((s, l) => s + l.shortLiquidationUsd, 0),
              timestamp: new Date(),
              // Mark as estimate for transparency
              isEstimate: true,
            } as LiquidationHeatmap;
          }),
          Effect.mapError((e) => mapError(e, symbol))
        ),
    });

    // Market summary cache
    const summaryCache = yield* Cache.make({
      capacity: 1,
      timeToLive: Duration.minutes(2),
      lookup: (_: "summary") =>
        Effect.gen(function* () {
          const topOI = yield* topOICache.get(20);
          const results = yield* Effect.forEach(
            topOI.map((o) => o.symbol),
            (s) => liqCache.get(`${s}:24h`).pipe(Effect.option),
            { concurrency: 10 }
          );
          const valid = pipe(
            results,
            Arr.filterMap((o) => (Option.isSome(o) ? Option.some(o.value) : Option.none()))
          );
          const totalLong = valid.reduce((s, r) => s + r.longLiquidationUsd, 0);
          const totalShort = valid.reduce((s, r) => s + r.shortLiquidationUsd, 0);
          return {
            totalLiquidations24h: valid.reduce((s, r) => s + r.totalLiquidations, 0),
            totalLiquidationUsd24h: totalLong + totalShort,
            longLiquidationUsd24h: totalLong,
            shortLiquidationUsd24h: totalShort,
            largestLiquidation: null,
            topLiquidatedSymbols: pipe(
              valid,
              Arr.sortBy((a, b) => (b.totalLiquidationUsd > a.totalLiquidationUsd ? 1 : -1)),
              Arr.take(10)
            ),
            timestamp: new Date(),
            // Mark as estimate for transparency
            isEstimate: true,
          } as MarketLiquidationSummary;
        }),
    });

    return {
      info: BINANCE_INFO,
      getLiquidations: (symbol, timeframe) => liqCache.get(`${symbol}:${timeframe}`),
      getLiquidationHeatmap: (symbol) => heatmapCache.get(symbol),
      getMarketLiquidationSummary: () => summaryCache.get("summary"),
      getOpenInterest: (symbol) => oiCache.get(symbol),
      getFundingRate: (symbol) => fundingCache.get(symbol),
      getTopOpenInterest: (limit = 20) => topOICache.get(limit),
    };
  })
);
