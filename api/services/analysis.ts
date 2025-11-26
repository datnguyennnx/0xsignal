/**
 * Analysis Service
 * Orchestrates analysis operations with optimized caching
 */

import { Effect, Context, Layer } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { AssetAnalysis, MarketOverview } from "../domain/types";
import { AnalysisError } from "../domain/types/errors";
import { CoinGeckoService } from "../infrastructure/data-sources/coingecko";
import { CacheService } from "../infrastructure/cache/memory.cache";
import { Logger } from "../infrastructure/logging/console.logger";
import { analyzeAsset } from "../application/analyze-asset";
import {
  analyzeMarket,
  createMarketOverview,
  filterHighConfidence,
} from "../application/analyze-market";

export interface AnalysisService {
  readonly analyzeSymbol: (symbol: string) => Effect.Effect<AssetAnalysis, AnalysisError>;
  readonly analyzeTopAssets: (
    limit: number
  ) => Effect.Effect<ReadonlyArray<AssetAnalysis>, AnalysisError>;
  readonly getMarketOverview: () => Effect.Effect<MarketOverview, AnalysisError>;
  readonly getHighConfidenceSignals: (
    minConfidence?: number
  ) => Effect.Effect<ReadonlyArray<AssetAnalysis>, AnalysisError>;
}

export class AnalysisServiceTag extends Context.Tag("AnalysisService")<
  AnalysisServiceTag,
  AnalysisService
>() {}

// ============================================================================
// Cache Keys & TTLs
// ============================================================================

const CACHE_KEYS = {
  topCryptos: (limit: number) => `analysis-top-cryptos-${limit}`,
  analysis: (symbol: string) => `analysis-${symbol}`,
  topAnalysis: (limit: number) => `top-analysis-${limit}`,
  overview: "market-overview",
} as const;

const CACHE_TTL = {
  prices: 60_000, // 1 minute for price data
  analysis: 120_000, // 2 minutes for analysis
} as const;

export const AnalysisServiceLive = Layer.effect(
  AnalysisServiceTag,
  Effect.gen(function* () {
    const coinGecko = yield* CoinGeckoService;
    const cache = yield* CacheService;
    const logger = yield* Logger;

    // Shared price fetcher with deduplication
    const fetchTopCryptos = (limit: number): Effect.Effect<CryptoPrice[], AnalysisError> =>
      cache.getOrFetch(
        CACHE_KEYS.topCryptos(limit),
        coinGecko.getTopCryptos(limit).pipe(
          Effect.mapError(
            (error) =>
              new AnalysisError({
                message: `Failed to fetch top cryptos: ${error.message}`,
                cause: error,
              })
          )
        ),
        CACHE_TTL.prices
      );

    const analyzeSymbol = (symbol: string): Effect.Effect<AssetAnalysis, AnalysisError> =>
      cache.getOrFetch(
        CACHE_KEYS.analysis(symbol),
        Effect.gen(function* () {
          yield* logger.info(`Analyzing ${symbol.toUpperCase()}`);

          const price = yield* coinGecko.getPrice(symbol).pipe(
            Effect.mapError(
              (error) =>
                new AnalysisError({
                  message: `Failed to fetch price data: ${error.message}`,
                  symbol,
                  cause: error,
                })
            )
          );

          return yield* analyzeAsset(price);
        }),
        CACHE_TTL.analysis
      );

    const analyzeTopAssets = (
      limit: number
    ): Effect.Effect<ReadonlyArray<AssetAnalysis>, AnalysisError> =>
      cache.getOrFetch(
        CACHE_KEYS.topAnalysis(limit),
        Effect.gen(function* () {
          yield* logger.info(`Analyzing top ${limit} assets`);

          const prices = yield* fetchTopCryptos(limit);
          return yield* analyzeMarket(prices);
        }),
        CACHE_TTL.analysis
      );

    const getMarketOverview = (): Effect.Effect<MarketOverview, AnalysisError> =>
      cache.getOrFetch(
        CACHE_KEYS.overview,
        Effect.gen(function* () {
          yield* logger.debug("Computing market overview");

          const analyses = yield* analyzeTopAssets(20);
          return createMarketOverview(analyses);
        }),
        CACHE_TTL.analysis
      );

    const getHighConfidenceSignals = (
      minConfidence: number = 70
    ): Effect.Effect<ReadonlyArray<AssetAnalysis>, AnalysisError> =>
      Effect.gen(function* () {
        const analyses = yield* analyzeTopAssets(50);
        return filterHighConfidence(analyses, minConfidence);
      });

    // Warmup cache on service initialization
    yield* Effect.forkDaemon(
      Effect.gen(function* () {
        yield* Effect.sleep("500 millis");
        yield* logger.info("Warming up analysis cache...");
        yield* cache.warmup(
          CACHE_KEYS.topCryptos(20),
          coinGecko
            .getTopCryptos(20)
            .pipe(Effect.mapError(() => new AnalysisError({ message: "warmup" }))),
          CACHE_TTL.prices
        );
      }).pipe(Effect.catchAll(() => Effect.void))
    );

    return {
      analyzeSymbol,
      analyzeTopAssets,
      getMarketOverview,
      getHighConfidenceSignals,
    };
  })
);
