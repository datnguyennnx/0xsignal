import { Effect, Context, Layer } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { AssetAnalysis, MarketOverview } from "../domain/types";
import { AnalysisError, MarketDataError } from "../domain/types/errors";
import { CoinGeckoService } from "../infrastructure/market-data/coingecko.adapter";
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

export const AnalysisServiceLive = Layer.effect(
  AnalysisServiceTag,
  Effect.gen(function* () {
    const coinGecko = yield* CoinGeckoService;
    const cache = yield* CacheService;
    const logger = yield* Logger;

    const analyzeSymbol = (symbol: string): Effect.Effect<AssetAnalysis, AnalysisError> =>
      Effect.gen(function* () {
        const cacheKey = `analysis-${symbol}`;
        const cached = yield* cache.get<AssetAnalysis>(cacheKey);

        if (cached) {
          yield* logger.debug(`Cache hit: ${symbol}`);
          return cached;
        }

        yield* logger.info(`Analyzing ${symbol.toUpperCase()}`);

        const price = yield* coinGecko.getPrice(symbol).pipe(
          Effect.catchTag("CoinGeckoError", (error) =>
            Effect.fail(
              new AnalysisError({
                message: `Failed to fetch price data: ${error.message}`,
                symbol,
                cause: error,
              })
            )
          )
        );

        const analysis = yield* analyzeAsset(price);

        yield* cache.set(cacheKey, analysis, 120000);

        return analysis;
      });

    const analyzeTopAssets = (
      limit: number
    ): Effect.Effect<ReadonlyArray<AssetAnalysis>, AnalysisError> =>
      Effect.gen(function* () {
        const cacheKey = `top-analysis-${limit}`;
        const cached = yield* cache.get<ReadonlyArray<AssetAnalysis>>(cacheKey);

        if (cached) {
          yield* logger.debug(`Cache hit: top ${limit}`);
          return cached;
        }

        yield* logger.info(`Analyzing top ${limit} assets`);

        const prices = yield* coinGecko.getTopCryptos(limit).pipe(
          Effect.catchTag("CoinGeckoError", (error) =>
            Effect.fail(
              new AnalysisError({
                message: `Failed to fetch top cryptos: ${error.message}`,
                cause: error,
              })
            )
          )
        );

        const analyses = yield* analyzeMarket(prices);

        yield* cache.set(cacheKey, analyses, 120000);

        return analyses;
      });

    const getMarketOverview = (): Effect.Effect<MarketOverview, AnalysisError> =>
      Effect.gen(function* () {
        const cacheKey = "market-overview";
        const cached = yield* cache.get<MarketOverview>(cacheKey);

        if (cached) {
          yield* logger.debug("Cache hit: market overview");
          return cached;
        }

        const analyses = yield* analyzeTopAssets(20);
        const overview = createMarketOverview(analyses);

        yield* cache.set(cacheKey, overview, 120000);

        return overview;
      });

    const getHighConfidenceSignals = (
      minConfidence: number = 70
    ): Effect.Effect<ReadonlyArray<AssetAnalysis>, AnalysisError> =>
      Effect.gen(function* () {
        const analyses = yield* analyzeTopAssets(50);
        return filterHighConfidence(analyses, minConfidence);
      });

    return {
      analyzeSymbol,
      analyzeTopAssets,
      getMarketOverview,
      getHighConfidenceSignals,
    };
  })
);
