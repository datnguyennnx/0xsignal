/**
 * Binance Provider
 * Futures data with schema validation, concurrent fetching, and Effect's Cache
 */

import { Effect, Context, Layer, Duration, Option, Cache } from "effect";
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
  BinanceExchangeInfoSchema,
} from "../../http/schemas";
import { DataSourceError, type AdapterInfo } from "../types";

// Adapter metadata
export const BINANCE_INFO: AdapterInfo = {
  name: "Binance",
  version: "1.0.0",
  capabilities: {
    spotPrices: true,
    futuresPrices: true,
    liquidations: true,
    openInterest: true,
    fundingRates: true,
    heatmap: false,
    historicalData: true,
    realtime: true,
  },
  rateLimit: { requestsPerMinute: 1200 },
};

const FUTURES_BASE = "https://fapi.binance.com/fapi/v1";
const FALLBACK_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT"];

// Normalize symbol to Binance format
const normalizeSymbol = (s: string): string => {
  const upper = s.toUpperCase();
  return upper.endsWith("USDT") ? upper : `${upper}USDT`;
};

// Cache configuration
const CACHE_CONFIG = {
  EXCHANGE_INFO_TTL: Duration.minutes(10),
  OPEN_INTEREST_TTL: Duration.minutes(2),
  FUNDING_RATE_TTL: Duration.minutes(5),
  LIQUIDATIONS_TTL: Duration.minutes(2),
  CAPACITY: 100,
};

// Service interface
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

// Service implementation with Effect's Cache
export const BinanceServiceLive = Layer.effect(
  BinanceService,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;

    // Map errors
    const mapError = (e: unknown, symbol?: string): DataSourceError =>
      new DataSourceError({
        source: "Binance",
        message: e instanceof Error ? e.message : "Unknown error",
        symbol,
      });

    // Cache for exchange info (available symbols)
    const symbolsCache = yield* Cache.make({
      capacity: 1,
      timeToLive: CACHE_CONFIG.EXCHANGE_INFO_TTL,
      lookup: (limit: number) =>
        http.get(`${FUTURES_BASE}/exchangeInfo`, BinanceExchangeInfoSchema).pipe(
          Effect.map((data) =>
            data.symbols
              .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
              .map((s) => s.symbol)
              .slice(0, limit)
          ),
          Effect.catchAll(() => Effect.succeed(FALLBACK_SYMBOLS.slice(0, limit))),
          Effect.mapError((e) => mapError(e))
        ),
    });

    // Fetch OI and ticker concurrently (not cached - used by other caches)
    const fetchOIAndTicker = (symbol: string) => {
      const sym = normalizeSymbol(symbol);
      return Effect.all({
        oi: http.get(`${FUTURES_BASE}/openInterest?symbol=${sym}`, BinanceOpenInterestSchema),
        ticker: http.get(`${FUTURES_BASE}/ticker/24hr?symbol=${sym}`, BinanceTickerSchema),
      }).pipe(Effect.mapError((e) => mapError(e, symbol)));
    };

    // Cache for open interest
    const openInterestCache = yield* Cache.make({
      capacity: CACHE_CONFIG.CAPACITY,
      timeToLive: CACHE_CONFIG.OPEN_INTEREST_TTL,
      lookup: (symbol: string) =>
        fetchOIAndTicker(symbol).pipe(
          Effect.map(({ oi, ticker }) => {
            const openInterest = parseFloat(oi.openInterest);
            const price = parseFloat(ticker.lastPrice);
            return {
              symbol: normalizeSymbol(symbol).replace("USDT", ""),
              openInterest,
              openInterestUsd: openInterest * price,
              change24h: parseFloat(ticker.priceChange),
              changePercent24h: parseFloat(ticker.priceChangePercent),
              timestamp: new Date(oi.time),
            } as OpenInterestData;
          })
        ),
    });

    // Cache for funding rate
    const fundingRateCache = yield* Cache.make({
      capacity: CACHE_CONFIG.CAPACITY,
      timeToLive: CACHE_CONFIG.FUNDING_RATE_TTL,
      lookup: (symbol: string) =>
        http
          .get(
            `${FUTURES_BASE}/premiumIndex?symbol=${normalizeSymbol(symbol)}`,
            BinancePremiumIndexSchema
          )
          .pipe(
            Effect.map(
              (data) =>
                ({
                  symbol: normalizeSymbol(symbol).replace("USDT", ""),
                  fundingRate: parseFloat(data.lastFundingRate) * 100,
                  nextFundingTime: new Date(data.nextFundingTime),
                  predictedRate: parseFloat(data.lastFundingRate) * 100,
                  timestamp: new Date(data.time),
                }) as FundingRateData
            ),
            Effect.mapError((e) => mapError(e, symbol))
          ),
    });

    // Cache for top open interest
    const topOICache = yield* Cache.make({
      capacity: 10,
      timeToLive: CACHE_CONFIG.OPEN_INTEREST_TTL,
      lookup: (limit: number) =>
        Effect.gen(function* () {
          const symbols = yield* symbolsCache.get(Math.min(limit * 2, 50));

          const results = yield* Effect.forEach(
            symbols,
            (sym) => openInterestCache.get(sym).pipe(Effect.option),
            { concurrency: 10 }
          );

          return results
            .filter(Option.isSome)
            .map((opt) => opt.value)
            .sort((a, b) => b.openInterestUsd - a.openInterestUsd)
            .slice(0, limit);
        }),
    });

    const TIMEFRAME_HOURS: Record<LiquidationTimeframe, number> = {
      "1h": 1,
      "4h": 4,
      "12h": 12,
      "24h": 24,
    };

    // Cache for liquidations
    const liquidationsCache = yield* Cache.make({
      capacity: CACHE_CONFIG.CAPACITY,
      timeToLive: CACHE_CONFIG.LIQUIDATIONS_TTL,
      lookup: (key: string) => {
        const [symbol, timeframe] = key.split(":") as [string, LiquidationTimeframe];
        return fetchOIAndTicker(symbol).pipe(
          Effect.map(({ oi, ticker }) => {
            const openInterest = parseFloat(oi.openInterest);
            const price = parseFloat(ticker.lastPrice);
            const priceChange = Math.abs(parseFloat(ticker.priceChangePercent));

            const volatilityFactor = Math.min(priceChange / 10, 1);
            const timeframeFactor = TIMEFRAME_HOURS[timeframe] / 24;
            const estimatedLiqUsd =
              openInterest * price * 0.01 * volatilityFactor * timeframeFactor;

            const isUp = parseFloat(ticker.priceChange) > 0;
            const longRatio = isUp ? 0.3 : 0.7;
            const longLiqUsd = estimatedLiqUsd * longRatio;
            const shortLiqUsd = estimatedLiqUsd * (1 - longRatio);

            return {
              symbol: normalizeSymbol(symbol).replace("USDT", ""),
              longLiquidations: Math.round(longLiqUsd / 25000),
              shortLiquidations: Math.round(shortLiqUsd / 25000),
              totalLiquidations: Math.round(estimatedLiqUsd / 25000),
              longLiquidationUsd: longLiqUsd,
              shortLiquidationUsd: shortLiqUsd,
              totalLiquidationUsd: estimatedLiqUsd,
              liquidationRatio: shortLiqUsd > 0 ? longLiqUsd / shortLiqUsd : 0,
              timestamp: new Date(),
              timeframe,
            } as LiquidationData;
          })
        );
      },
    });

    // Cache for liquidation heatmap
    const heatmapCache = yield* Cache.make({
      capacity: CACHE_CONFIG.CAPACITY,
      timeToLive: CACHE_CONFIG.LIQUIDATIONS_TTL,
      lookup: (symbol: string) =>
        http
          .get(`${FUTURES_BASE}/ticker/24hr?symbol=${normalizeSymbol(symbol)}`, BinanceTickerSchema)
          .pipe(
            Effect.map((ticker) => {
              const currentPrice = parseFloat(ticker.lastPrice);
              const high24h = parseFloat(ticker.highPrice);
              const low24h = parseFloat(ticker.lowPrice);
              const volume = parseFloat(ticker.quoteVolume);

              const range = high24h - low24h;
              const bucketSize = range / 10;
              const levels: LiquidationLevel[] = [];

              for (let i = 0; i < 10; i++) {
                const price = low24h + bucketSize * i + bucketSize / 2;
                const distanceFromCurrent = Math.abs(price - currentPrice) / currentPrice;
                const proximityFactor = Math.max(0, 1 - distanceFromCurrent * 5);
                const baseUsd = volume * 0.001 * proximityFactor;

                const isAbove = price > currentPrice;
                levels.push({
                  price: Math.round(price * 100) / 100,
                  longLiquidationUsd: isAbove ? baseUsd * 0.3 : baseUsd * 0.7,
                  shortLiquidationUsd: isAbove ? baseUsd * 0.7 : baseUsd * 0.3,
                  totalUsd: baseUsd,
                  intensity: proximityFactor * 100,
                });
              }

              return {
                symbol: normalizeSymbol(symbol).replace("USDT", ""),
                levels,
                currentPrice,
                highestLiquidationPrice: high24h,
                lowestLiquidationPrice: low24h,
                totalLongLiquidationUsd: levels.reduce((s, l) => s + l.longLiquidationUsd, 0),
                totalShortLiquidationUsd: levels.reduce((s, l) => s + l.shortLiquidationUsd, 0),
                timestamp: new Date(),
              } as LiquidationHeatmap;
            }),
            Effect.mapError((e) => mapError(e, symbol))
          ),
    });

    // Cache for market liquidation summary
    const marketSummaryCache = yield* Cache.make({
      capacity: 1,
      timeToLive: CACHE_CONFIG.LIQUIDATIONS_TTL,
      lookup: (_: "summary") =>
        Effect.gen(function* () {
          const symbols = yield* symbolsCache.get(20);

          const results = yield* Effect.forEach(
            symbols,
            (sym) => liquidationsCache.get(`${sym}:24h`).pipe(Effect.option),
            { concurrency: 10 }
          );

          const valid = results.filter(Option.isSome).map((opt) => opt.value);

          const totalLong = valid.reduce((s, r) => s + r.longLiquidationUsd, 0);
          const totalShort = valid.reduce((s, r) => s + r.shortLiquidationUsd, 0);

          return {
            totalLiquidations24h: valid.reduce((s, r) => s + r.totalLiquidations, 0),
            totalLiquidationUsd24h: totalLong + totalShort,
            longLiquidationUsd24h: totalLong,
            shortLiquidationUsd24h: totalShort,
            largestLiquidation: null,
            topLiquidatedSymbols: valid
              .sort((a, b) => b.totalLiquidationUsd - a.totalLiquidationUsd)
              .slice(0, 10),
            timestamp: new Date(),
          } as MarketLiquidationSummary;
        }),
    });

    return {
      info: BINANCE_INFO,
      getLiquidations: (symbol: string, timeframe: LiquidationTimeframe) =>
        liquidationsCache.get(`${symbol}:${timeframe}`),
      getLiquidationHeatmap: (symbol: string) => heatmapCache.get(symbol),
      getMarketLiquidationSummary: () => marketSummaryCache.get("summary"),
      getOpenInterest: (symbol: string) => openInterestCache.get(symbol),
      getFundingRate: (symbol: string) => fundingRateCache.get(symbol),
      getTopOpenInterest: (limit = 20) => topOICache.get(limit),
    };
  })
);
