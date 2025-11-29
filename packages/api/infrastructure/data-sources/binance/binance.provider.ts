/** Binance Provider - Futures data with caching */

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

const FUTURES_BASE = "https://fapi.binance.com/fapi/v1";
const FALLBACK_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT"];
const TIMEFRAME_HOURS: Record<LiquidationTimeframe, number> = {
  "1h": 1,
  "4h": 4,
  "12h": 12,
  "24h": 24,
};

const normalizeSymbol = (s: string) => {
  const upper = s.toUpperCase();
  return upper.endsWith("USDT") ? upper : `${upper}USDT`;
};

const stripUsdt = (s: string) => normalizeSymbol(s).replace("USDT", "");
const mapError = (e: unknown, symbol?: string): DataSourceError =>
  new DataSourceError({
    source: "Binance",
    message: e instanceof Error ? e.message : "Unknown error",
    symbol,
  });

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

    // Fetch OI + Ticker together
    const fetchOITicker = (symbol: string) =>
      Effect.all({
        oi: http.get(
          `${FUTURES_BASE}/openInterest?symbol=${normalizeSymbol(symbol)}`,
          BinanceOpenInterestSchema
        ),
        ticker: http.get(
          `${FUTURES_BASE}/ticker/24hr?symbol=${normalizeSymbol(symbol)}`,
          BinanceTickerSchema
        ),
      }).pipe(Effect.mapError((e) => mapError(e, symbol)));

    // Symbols cache
    const symbolsCache = yield* Cache.make({
      capacity: 1,
      timeToLive: Duration.minutes(10),
      lookup: (limit: number) =>
        http.get(`${FUTURES_BASE}/exchangeInfo`, BinanceExchangeInfoSchema).pipe(
          Effect.map((d) =>
            d.symbols
              .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
              .map((s) => s.symbol)
              .slice(0, limit)
          ),
          Effect.catchAll(() => Effect.succeed(FALLBACK_SYMBOLS.slice(0, limit))),
          Effect.mapError(mapError)
        ),
    });

    // Open Interest cache
    const oiCache = yield* Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(2),
      lookup: (symbol: string) =>
        fetchOITicker(symbol).pipe(
          Effect.map(({ oi, ticker }) => {
            const openInterest = parseFloat(oi.openInterest);
            const price = parseFloat(ticker.lastPrice);
            return {
              symbol: stripUsdt(symbol),
              openInterest,
              openInterestUsd: openInterest * price,
              change24h: parseFloat(ticker.priceChange),
              changePercent24h: parseFloat(ticker.priceChangePercent),
              timestamp: new Date(oi.time),
            } as OpenInterestData;
          })
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
                  symbol: stripUsdt(symbol),
                  fundingRate: parseFloat(d.lastFundingRate) * 100,
                  nextFundingTime: new Date(d.nextFundingTime),
                  predictedRate: parseFloat(d.lastFundingRate) * 100,
                  timestamp: new Date(d.time),
                }) as FundingRateData
            ),
            Effect.mapError((e) => mapError(e, symbol))
          ),
    });

    // Top OI cache
    const topOICache = yield* Cache.make({
      capacity: 10,
      timeToLive: Duration.minutes(2),
      lookup: (limit: number) =>
        Effect.gen(function* () {
          const symbols = yield* symbolsCache.get(Math.min(limit * 2, 50));
          const results = yield* Effect.forEach(
            symbols,
            (s) => oiCache.get(s).pipe(Effect.option),
            { concurrency: 10 }
          );
          return results
            .filter(Option.isSome)
            .map((o) => o.value)
            .sort((a, b) => b.openInterestUsd - a.openInterestUsd)
            .slice(0, limit);
        }),
    });

    // Liquidations cache
    const liqCache = yield* Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(2),
      lookup: (key: string) => {
        const [symbol, timeframe] = key.split(":") as [string, LiquidationTimeframe];
        return fetchOITicker(symbol).pipe(
          Effect.map(({ oi, ticker }) => {
            const openInterest = parseFloat(oi.openInterest);
            const price = parseFloat(ticker.lastPrice);
            const volatility = Math.min(Math.abs(parseFloat(ticker.priceChangePercent)) / 10, 1);
            const timeFactor = TIMEFRAME_HOURS[timeframe] / 24;
            const estLiqUsd = openInterest * price * 0.01 * volatility * timeFactor;
            const isUp = parseFloat(ticker.priceChange) > 0;
            const longRatio = isUp ? 0.3 : 0.7;
            const longUsd = estLiqUsd * longRatio;
            const shortUsd = estLiqUsd * (1 - longRatio);
            return {
              symbol: stripUsdt(symbol),
              longLiquidations: Math.round(longUsd / 25000),
              shortLiquidations: Math.round(shortUsd / 25000),
              totalLiquidations: Math.round(estLiqUsd / 25000),
              longLiquidationUsd: longUsd,
              shortLiquidationUsd: shortUsd,
              totalLiquidationUsd: estLiqUsd,
              liquidationRatio: shortUsd > 0 ? longUsd / shortUsd : 0,
              timestamp: new Date(),
              timeframe,
            } as LiquidationData;
          })
        );
      },
    });

    // Heatmap cache
    const heatmapCache = yield* Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(2),
      lookup: (symbol: string) =>
        http
          .get(`${FUTURES_BASE}/ticker/24hr?symbol=${normalizeSymbol(symbol)}`, BinanceTickerSchema)
          .pipe(
            Effect.map((ticker) => {
              const price = parseFloat(ticker.lastPrice);
              const high = parseFloat(ticker.highPrice);
              const low = parseFloat(ticker.lowPrice);
              const volume = parseFloat(ticker.quoteVolume);
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
                symbol: stripUsdt(symbol),
                levels,
                currentPrice: price,
                highestLiquidationPrice: high,
                lowestLiquidationPrice: low,
                totalLongLiquidationUsd: levels.reduce((s, l) => s + l.longLiquidationUsd, 0),
                totalShortLiquidationUsd: levels.reduce((s, l) => s + l.shortLiquidationUsd, 0),
                timestamp: new Date(),
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
          const symbols = yield* symbolsCache.get(20);
          const results = yield* Effect.forEach(
            symbols,
            (s) => liqCache.get(`${s}:24h`).pipe(Effect.option),
            { concurrency: 10 }
          );
          const valid = results.filter(Option.isSome).map((o) => o.value);
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
      getLiquidations: (symbol, timeframe) => liqCache.get(`${symbol}:${timeframe}`),
      getLiquidationHeatmap: (symbol) => heatmapCache.get(symbol),
      getMarketLiquidationSummary: () => summaryCache.get("summary"),
      getOpenInterest: (symbol) => oiCache.get(symbol),
      getFundingRate: (symbol) => fundingCache.get(symbol),
      getTopOpenInterest: (limit = 20) => topOICache.get(limit),
    };
  })
);
