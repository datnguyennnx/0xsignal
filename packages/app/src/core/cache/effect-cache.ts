// Effect-TS Cache Layer - TTL-based caching with dependency injection

import { Effect, Cache, Duration, pipe, Layer, Context } from "effect";
import type {
  AssetAnalysis,
  MarketOverview,
  ChartDataPoint,
  MarketHeatmap,
  BuybackOverview,
  ProtocolBuybackDetail,
  LiquidationHeatmap,
  OpenInterestData,
  FundingRateData,
  GlobalMarketData,
} from "@0xsignal/shared";
import { ApiServiceTag } from "../api/client";
import type { ApiError, NetworkError } from "../api/errors";

// Cache TTL Configuration - Optimized to prevent 429 rate limit errors
const CACHE_CONFIG = {
  SHORT_TTL: Duration.minutes(10), // 10 min for frequently changing data (charts, liquidations)
  MEDIUM_TTL: Duration.minutes(15), // 15 min for analysis data
  LONG_TTL: Duration.minutes(30), // 30 min for stable data (buybacks, metadata)
  SMALL_CAPACITY: 20,
  MEDIUM_CAPACITY: 100,
  LARGE_CAPACITY: 500,
} as const;

// Cache Service Interface
export interface CacheService {
  readonly topAnalysis: Cache.Cache<number, AssetAnalysis[], ApiError | NetworkError>;
  readonly analysis: Cache.Cache<string, AssetAnalysis, ApiError | NetworkError>;
  readonly chartData: Cache.Cache<string, ChartDataPoint[], ApiError | NetworkError>;
  readonly overview: Cache.Cache<"overview", MarketOverview, ApiError | NetworkError>;
  readonly heatmap: Cache.Cache<number, MarketHeatmap, ApiError | NetworkError>;
  readonly buybackOverview: Cache.Cache<"overview", BuybackOverview, ApiError | NetworkError>;
  readonly buybackDetail: Cache.Cache<string, ProtocolBuybackDetail, ApiError | NetworkError>;
  readonly liquidationHeatmap: Cache.Cache<string, LiquidationHeatmap, ApiError | NetworkError>;
  readonly openInterest: Cache.Cache<string, OpenInterestData, ApiError | NetworkError>;
  readonly fundingRate: Cache.Cache<string, FundingRateData, ApiError | NetworkError>;
  readonly globalMarket: Cache.Cache<"global", GlobalMarketData, ApiError | NetworkError>;
}

export class CacheServiceTag extends Context.Tag("CacheService")<CacheServiceTag, CacheService>() {}

// Cache Factory Functions
const makeTopAnalysisCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: CACHE_CONFIG.SMALL_CAPACITY,
    timeToLive: CACHE_CONFIG.MEDIUM_TTL,
    lookup: (limit: number) =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getTopAnalysis(limit))
      ),
  });
});

const makeAnalysisCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: CACHE_CONFIG.LARGE_CAPACITY,
    timeToLive: CACHE_CONFIG.MEDIUM_TTL,
    lookup: (symbol: string) =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getAnalysis(symbol))
      ),
  });
});

const makeChartDataCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: CACHE_CONFIG.MEDIUM_CAPACITY,
    timeToLive: CACHE_CONFIG.SHORT_TTL,
    lookup: (key: string) => {
      const [symbol, interval, timeframe] = key.split("|");
      return pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getChartData(symbol, interval, timeframe))
      );
    },
  });
});

const makeOverviewCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: 1,
    timeToLive: CACHE_CONFIG.MEDIUM_TTL,
    lookup: (_: "overview") =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getOverview())
      ),
  });
});

const makeHeatmapCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: CACHE_CONFIG.SMALL_CAPACITY,
    timeToLive: CACHE_CONFIG.MEDIUM_TTL,
    lookup: (limit: number) =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getHeatmap(limit))
      ),
  });
});

const makeBuybackOverviewCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: 1,
    timeToLive: CACHE_CONFIG.MEDIUM_TTL,
    lookup: (_: "overview") =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getBuybackOverview())
      ),
  });
});

const makeBuybackDetailCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: CACHE_CONFIG.MEDIUM_CAPACITY,
    timeToLive: CACHE_CONFIG.MEDIUM_TTL,
    lookup: (protocol: string) =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getProtocolBuybackDetail(protocol))
      ),
  });
});

const makeLiquidationHeatmapCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: CACHE_CONFIG.MEDIUM_CAPACITY,
    timeToLive: CACHE_CONFIG.SHORT_TTL,
    lookup: (symbol: string) =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getLiquidationHeatmap(symbol))
      ),
  });
});

const makeOpenInterestCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: CACHE_CONFIG.MEDIUM_CAPACITY,
    timeToLive: CACHE_CONFIG.SHORT_TTL,
    lookup: (symbol: string) =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getOpenInterest(symbol))
      ),
  });
});

const makeFundingRateCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: CACHE_CONFIG.MEDIUM_CAPACITY,
    timeToLive: CACHE_CONFIG.SHORT_TTL,
    lookup: (symbol: string) =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getFundingRate(symbol))
      ),
  });
});

const makeGlobalMarketCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: 1,
    timeToLive: CACHE_CONFIG.MEDIUM_TTL,
    lookup: (_: "global") =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getGlobalMarket())
      ),
  });
});

// Cache Service Layer
export const CacheServiceLive = Layer.effect(
  CacheServiceTag,
  Effect.gen(function* () {
    return {
      topAnalysis: yield* makeTopAnalysisCache,
      analysis: yield* makeAnalysisCache,
      chartData: yield* makeChartDataCache,
      overview: yield* makeOverviewCache,
      heatmap: yield* makeHeatmapCache,
      buybackOverview: yield* makeBuybackOverviewCache,
      buybackDetail: yield* makeBuybackDetailCache,
      liquidationHeatmap: yield* makeLiquidationHeatmapCache,
      openInterest: yield* makeOpenInterestCache,
      fundingRate: yield* makeFundingRateCache,
      globalMarket: yield* makeGlobalMarketCache,
    };
  })
);

// Cached Query Functions
export const cachedTopAnalysis = (limit = 20) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.topAnalysis.get(limit);
  });

export const cachedAnalysis = (symbol: string) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.analysis.get(symbol);
  });

export const cachedChartData = (symbol: string, interval: string, timeframe: string) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.chartData.get(`${symbol}|${interval}|${timeframe}`);
  });

export const cachedOverview = () =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.overview.get("overview");
  });

export const cachedHeatmap = (limit = 100) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.heatmap.get(limit);
  });

export const cachedBuybackOverview = () =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.buybackOverview.get("overview");
  });

export const cachedBuybackDetail = (protocol: string) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.buybackDetail.get(protocol);
  });

export const cachedLiquidationHeatmap = (symbol: string) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.liquidationHeatmap.get(symbol);
  });

export const cachedOpenInterest = (symbol: string) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.openInterest.get(symbol);
  });

export const cachedFundingRate = (symbol: string) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.fundingRate.get(symbol);
  });

export const cachedGlobalMarket = () =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.globalMarket.get("global");
  });

// Cache Invalidation
export const invalidateTopAnalysis = () =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    yield* cache.topAnalysis.invalidateAll;
  });

export const invalidateAnalysis = (symbol: string) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    yield* cache.analysis.invalidate(symbol);
  });

export const invalidateChartData = (symbol: string, interval: string, timeframe: string) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    yield* cache.chartData.invalidate(`${symbol}|${interval}|${timeframe}`);
  });

export const invalidateAll = () =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    yield* Effect.all(
      [
        cache.topAnalysis.invalidateAll,
        cache.analysis.invalidateAll,
        cache.chartData.invalidateAll,
        cache.overview.invalidateAll,
        cache.heatmap.invalidateAll,
        cache.buybackOverview.invalidateAll,
        cache.buybackDetail.invalidateAll,
        cache.liquidationHeatmap.invalidateAll,
        cache.openInterest.invalidateAll,
        cache.fundingRate.invalidateAll,
        cache.globalMarket.invalidateAll,
      ],
      { concurrency: "unbounded" }
    );
  });

// Cache Statistics
export const getCacheStats = () =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    const [topAnalysisSize, analysisSize, chartDataSize, overviewSize, heatmapSize] =
      yield* Effect.all(
        [
          cache.topAnalysis.size,
          cache.analysis.size,
          cache.chartData.size,
          cache.overview.size,
          cache.heatmap.size,
        ],
        { concurrency: "unbounded" }
      );
    return {
      topAnalysis: topAnalysisSize,
      analysis: analysisSize,
      chartData: chartDataSize,
      overview: overviewSize,
      heatmap: heatmapSize,
    };
  });
