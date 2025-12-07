/** Analysis Service - Asset analysis orchestration with tracing */

import { Effect, Context, Layer, Cache, pipe } from "effect";
import type { AssetAnalysis, MarketOverview } from "../domain/types";
import { AnalysisError } from "../domain/types/errors";
import { ChartDataService } from "../infrastructure/data-sources/binance";
import { CoinGeckoService } from "../infrastructure/data-sources/coingecko";
import { analyzeAsset } from "../application/analyze-asset";
import {
  analyzeMarket,
  createMarketOverview,
  filterHighConfidence,
} from "../application/analyze-market";
import { CACHE_TTL, CACHE_CAPACITY } from "../infrastructure/config/app.config";

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

const mapToAnalysisError = (e: unknown, symbol?: string) =>
  new AnalysisError({ message: e instanceof Error ? e.message : String(e), symbol, cause: e });

export const AnalysisServiceLive = Layer.effect(
  AnalysisServiceTag,
  Effect.gen(function* () {
    const coinGecko = yield* CoinGeckoService;
    const chartService = yield* ChartDataService;

    const symbolCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.ANALYSIS,
      lookup: (symbol: string) =>
        Effect.gen(function* () {
          const price = yield* coinGecko
            .getPrice(symbol)
            .pipe(Effect.mapError((e) => mapToAnalysisError(e, symbol)));
          return yield* analyzeAsset(price);
        }),
    });

    // Full-list cache: fetch 250 once, slice in-memory per request
    const topAssetsCache = yield* Cache.make({
      capacity: 10,
      timeToLive: CACHE_TTL.ANALYSIS,
      lookup: (limit: number) =>
        Effect.gen(function* () {
          const prices = yield* coinGecko
            .getTopCryptos(limit)
            .pipe(Effect.mapError(mapToAnalysisError));
          return yield* analyzeMarket(prices, chartService);
        }),
    });

    const overviewCache = yield* Cache.make({
      capacity: 1,
      timeToLive: CACHE_TTL.ANALYSIS,
      lookup: (_: "overview") => topAssetsCache.get(20).pipe(Effect.map(createMarketOverview)),
    });

    return {
      analyzeSymbol: (symbol) =>
        pipe(
          symbolCache.get(symbol),
          Effect.withSpan("analysis.symbol", { attributes: { symbol } })
        ),
      analyzeTopAssets: (limit) =>
        pipe(
          topAssetsCache.get(limit),
          Effect.withSpan("analysis.topAssets", { attributes: { limit } })
        ),
      getMarketOverview: () =>
        pipe(overviewCache.get("overview"), Effect.withSpan("analysis.marketOverview")),
      getHighConfidenceSignals: (minConfidence = 70) =>
        pipe(
          topAssetsCache.get(50),
          Effect.map((analyses) => filterHighConfidence(analyses, minConfidence)),
          Effect.withSpan("analysis.highConfidence", { attributes: { minConfidence } })
        ),
    };
  })
);
