/**
 * Binance Provider
 * Free public APIs for futures data (open interest, funding rates)
 * Liquidation data is estimated based on market metrics
 * https://binance-docs.github.io/apidocs/futures/en/
 */

import { Effect, Context, Layer } from "effect";
import type {
  LiquidationData,
  LiquidationHeatmap,
  LiquidationLevel,
  MarketLiquidationSummary,
  LiquidationTimeframe,
  OpenInterestData,
  FundingRateData,
} from "@0xsignal/shared";
import { HttpService } from "../http.service";
import { DataSourceError, type AdapterInfo } from "../types";

// ============================================================================
// Adapter Info
// ============================================================================

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
  rateLimit: {
    requestsPerMinute: 1200,
  },
};

// ============================================================================
// API Response Types
// ============================================================================

interface BinanceOpenInterestResponse {
  readonly symbol: string;
  readonly openInterest: string;
  readonly time: number;
}

interface BinancePremiumIndexResponse {
  readonly symbol: string;
  readonly markPrice: string;
  readonly indexPrice: string;
  readonly lastFundingRate: string;
  readonly nextFundingTime: number;
  readonly time: number;
}

interface BinanceTickerResponse {
  readonly symbol: string;
  readonly priceChange: string;
  readonly priceChangePercent: string;
  readonly lastPrice: string;
  readonly highPrice: string;
  readonly lowPrice: string;
  readonly volume: string;
  readonly quoteVolume: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const normalizeSymbol = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  if (upper.endsWith("USDT")) return upper;
  return `${upper}USDT`;
};

// Fallback symbols if API fails
const FALLBACK_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT"];

interface BinanceExchangeSymbol {
  readonly symbol: string;
  readonly status: string;
  readonly baseAsset: string;
  readonly quoteAsset: string;
}

// ============================================================================
// Binance Service Tag
// ============================================================================

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

// ============================================================================
// Binance Service Implementation
// ============================================================================

export const BinanceServiceLive = Layer.effect(
  BinanceService,
  Effect.gen(function* () {
    const http = yield* HttpService;

    const futuresBaseUrl = "https://fapi.binance.com/fapi/v1";

    const mapError = (error: unknown, symbol?: string): DataSourceError =>
      new DataSourceError({
        source: "Binance",
        message: error instanceof Error ? error.message : "Unknown error",
        symbol,
      });

    // Fetch available USDT perpetual symbols from Binance
    const getAvailableSymbols = (limit: number): Effect.Effect<string[], DataSourceError> =>
      http.get(`${futuresBaseUrl}/exchangeInfo`).pipe(
        Effect.map((response) => {
          const data = response as { symbols: BinanceExchangeSymbol[] };
          return data.symbols
            .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
            .map((s) => s.symbol)
            .slice(0, limit);
        }),
        Effect.catchAll(() => Effect.succeed(FALLBACK_SYMBOLS.slice(0, limit)))
      );

    // Shared helper to fetch OI and ticker data
    const fetchOIAndTicker = (symbol: string) => {
      const normalizedSymbol = normalizeSymbol(symbol);
      return Effect.all({
        oi: http.get(`${futuresBaseUrl}/openInterest?symbol=${normalizedSymbol}`).pipe(
          Effect.map((r) => r as BinanceOpenInterestResponse),
          Effect.mapError((e) => mapError(e, symbol))
        ),
        ticker: http.get(`${futuresBaseUrl}/ticker/24hr?symbol=${normalizedSymbol}`).pipe(
          Effect.map((r) => r as BinanceTickerResponse),
          Effect.mapError((e) => mapError(e, symbol))
        ),
      });
    };

    // Get open interest for a symbol
    const getOpenInterest = (symbol: string): Effect.Effect<OpenInterestData, DataSourceError> =>
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
          };
        })
      );

    // Get funding rate for a symbol
    const getFundingRate = (symbol: string): Effect.Effect<FundingRateData, DataSourceError> =>
      Effect.gen(function* () {
        const normalizedSymbol = normalizeSymbol(symbol);
        const url = `${futuresBaseUrl}/premiumIndex?symbol=${normalizedSymbol}`;

        const response = yield* http.get(url).pipe(Effect.mapError((e) => mapError(e, symbol)));
        const data = response as BinancePremiumIndexResponse;

        return {
          symbol: normalizedSymbol.replace("USDT", ""),
          fundingRate: parseFloat(data.lastFundingRate) * 100,
          nextFundingTime: new Date(data.nextFundingTime),
          predictedRate: parseFloat(data.lastFundingRate) * 100,
          timestamp: new Date(data.time),
        };
      });

    // Get top open interest - dynamically fetches available symbols
    const getTopOpenInterest = (
      limit: number = 20
    ): Effect.Effect<OpenInterestData[], DataSourceError> =>
      Effect.gen(function* () {
        const symbols = yield* getAvailableSymbols(Math.min(limit * 2, 50)); // Fetch more to account for failures

        const results = yield* Effect.forEach(
          symbols,
          (sym) => getOpenInterest(sym).pipe(Effect.catchAll(() => Effect.succeed(null))),
          { concurrency: 10 }
        );

        return results
          .filter((r): r is OpenInterestData => r !== null)
          .sort((a, b) => b.openInterestUsd - a.openInterestUsd)
          .slice(0, limit);
      });

    const TIMEFRAME_HOURS: Record<LiquidationTimeframe, number> = {
      "1h": 1,
      "4h": 4,
      "12h": 12,
      "24h": 24,
    };
    const AVG_LIQ_SIZE = 25000;

    // Get liquidations - estimated based on open interest and price volatility
    const getLiquidations = (
      symbol: string,
      timeframe: LiquidationTimeframe
    ): Effect.Effect<LiquidationData, DataSourceError> =>
      fetchOIAndTicker(symbol).pipe(
        Effect.map(({ oi, ticker }) => {
          const openInterest = parseFloat(oi.openInterest);
          const price = parseFloat(ticker.lastPrice);
          const priceChange = Math.abs(parseFloat(ticker.priceChangePercent));

          const volatilityFactor = Math.min(priceChange / 10, 1);
          const timeframeFactor = TIMEFRAME_HOURS[timeframe] / 24;
          const estimatedLiquidationUsd =
            openInterest * price * 0.01 * volatilityFactor * timeframeFactor;

          const isUp = parseFloat(ticker.priceChange) > 0;
          const longRatio = isUp ? 0.3 : 0.7;

          const longLiquidationUsd = estimatedLiquidationUsd * longRatio;
          const shortLiquidationUsd = estimatedLiquidationUsd * (1 - longRatio);
          const longLiquidations = Math.round(longLiquidationUsd / AVG_LIQ_SIZE);
          const shortLiquidations = Math.round(shortLiquidationUsd / AVG_LIQ_SIZE);

          return {
            symbol: normalizeSymbol(symbol).replace("USDT", ""),
            longLiquidations,
            shortLiquidations,
            totalLiquidations: longLiquidations + shortLiquidations,
            longLiquidationUsd,
            shortLiquidationUsd,
            totalLiquidationUsd: longLiquidationUsd + shortLiquidationUsd,
            liquidationRatio:
              shortLiquidationUsd > 0 ? longLiquidationUsd / shortLiquidationUsd : 0,
            timestamp: new Date(),
            timeframe,
          };
        })
      );

    // Get liquidation heatmap - estimated price levels
    const getLiquidationHeatmap = (
      symbol: string
    ): Effect.Effect<LiquidationHeatmap, DataSourceError> =>
      Effect.gen(function* () {
        const normalizedSymbol = normalizeSymbol(symbol);
        const tickerUrl = `${futuresBaseUrl}/ticker/24hr?symbol=${normalizedSymbol}`;

        const tickerResponse = yield* http
          .get(tickerUrl)
          .pipe(Effect.mapError((e) => mapError(e, symbol)));
        const ticker = tickerResponse as BinanceTickerResponse;

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
          const longUsd = isAbove ? baseUsd * 0.3 : baseUsd * 0.7;
          const shortUsd = isAbove ? baseUsd * 0.7 : baseUsd * 0.3;

          levels.push({
            price: Math.round(price * 100) / 100,
            longLiquidationUsd: longUsd,
            shortLiquidationUsd: shortUsd,
            totalUsd: longUsd + shortUsd,
            intensity: proximityFactor * 100,
          });
        }

        const totalLong = levels.reduce((sum, l) => sum + l.longLiquidationUsd, 0);
        const totalShort = levels.reduce((sum, l) => sum + l.shortLiquidationUsd, 0);

        return {
          symbol: normalizedSymbol.replace("USDT", ""),
          levels,
          currentPrice,
          highestLiquidationPrice: high24h,
          lowestLiquidationPrice: low24h,
          totalLongLiquidationUsd: totalLong,
          totalShortLiquidationUsd: totalShort,
          timestamp: new Date(),
        };
      });

    // Get market-wide liquidation summary - dynamically fetches symbols
    const getMarketLiquidationSummary = (): Effect.Effect<
      MarketLiquidationSummary,
      DataSourceError
    > =>
      Effect.gen(function* () {
        const symbols = yield* getAvailableSymbols(20);

        const results = yield* Effect.forEach(
          symbols,
          (sym) => getLiquidations(sym, "24h").pipe(Effect.catchAll(() => Effect.succeed(null))),
          { concurrency: 10 }
        );

        const validResults = results.filter((r): r is LiquidationData => r !== null);

        const totalLong = validResults.reduce((sum, r) => sum + r.longLiquidationUsd, 0);
        const totalShort = validResults.reduce((sum, r) => sum + r.shortLiquidationUsd, 0);
        const totalCount = validResults.reduce((sum, r) => sum + r.totalLiquidations, 0);

        const topSymbols = validResults
          .sort((a, b) => b.totalLiquidationUsd - a.totalLiquidationUsd)
          .slice(0, 10);

        return {
          totalLiquidations24h: totalCount,
          totalLiquidationUsd24h: totalLong + totalShort,
          longLiquidationUsd24h: totalLong,
          shortLiquidationUsd24h: totalShort,
          largestLiquidation: null,
          topLiquidatedSymbols: topSymbols,
          timestamp: new Date(),
        };
      });

    return {
      info: BINANCE_INFO,
      getLiquidations,
      getLiquidationHeatmap,
      getMarketLiquidationSummary,
      getOpenInterest,
      getFundingRate,
      getTopOpenInterest,
    };
  })
);
