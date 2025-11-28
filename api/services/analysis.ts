/**
 * Analysis Service
 * Orchestrates asset analysis - caching is handled by CoinGeckoService
 */

import { Effect, Context, Layer, Cache } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { AssetAnalysis, MarketOverview } from "../domain/types";
import { AnalysisError } from "../domain/types/errors";
import { CoinGeckoService } from "../infrastructure/data-sources/coingecko";
import { analyzeAsset } from "../application/analyze-asset";
import {
  analyzeMarket,
  createMarketOverview,
  filterHighConfidence,
} from "../application/analyze-market";
import { CACHE_TTL, CACHE_CAPACITY } from "../infrastructure/config/app.config";

// Service interface
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

// Service implementation - uses CoinGeckoService's cache + own analysis cache
export const AnalysisServiceLive = Layer.effect(
  AnalysisServiceTag,
  Effect.gen(function* () {
    const coinGecko = yield* CoinGeckoService;

    // Cache for single symbol analysis
    const symbolAnalysisCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.ANALYSIS,
      lookup: (symbol: string) =>
        Effect.gen(function* () {
          yield* Effect.logDebug(`[Analysis] Analyzing ${symbol.toUpperCase()}`);
          const price = yield* coinGecko.getPrice(symbol).pipe(
            Effect.mapError(
              (e) =>
                new AnalysisError({
                  message: `Failed to fetch price: ${e.message}`,
                  symbol,
                  cause: e,
                })
            )
          );
          return yield* analyzeAsset(price);
        }),
    });

    // Cache for top assets analysis
    const topAssetsCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SINGLE,
      timeToLive: CACHE_TTL.ANALYSIS,
      lookup: (limit: number) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[Analysis] Analyzing top ${limit} assets`);
          const prices = yield* coinGecko
            .getTopCryptos(limit)
            .pipe(
              Effect.mapError(
                (e) =>
                  new AnalysisError({ message: `Failed to fetch prices: ${e.message}`, cause: e })
              )
            );
          const analyses = yield* analyzeMarket(prices);
          yield* Effect.logDebug(`[Analysis] Completed analysis for ${analyses.length} assets`);
          return analyses;
        }),
    });

    // Cache for market overview
    const overviewCache = yield* Cache.make({
      capacity: 1,
      timeToLive: CACHE_TTL.ANALYSIS,
      lookup: (_: "overview") =>
        Effect.gen(function* () {
          yield* Effect.logInfo("[Analysis] Computing market overview");
          const analyses = yield* topAssetsCache.get(20);
          return createMarketOverview(analyses);
        }),
    });

    return {
      analyzeSymbol: (symbol: string) => symbolAnalysisCache.get(symbol),
      analyzeTopAssets: (limit: number) => topAssetsCache.get(limit),
      getMarketOverview: () => overviewCache.get("overview"),
      getHighConfidenceSignals: (minConfidence = 70) =>
        topAssetsCache
          .get(50)
          .pipe(Effect.map((analyses) => filterHighConfidence(analyses, minConfidence))),
    };
  })
);
