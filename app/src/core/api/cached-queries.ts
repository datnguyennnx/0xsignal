import { Effect, pipe, Cache, Duration } from "effect";
import { ApiService, type ChartDataPoint } from "./client";
import type { EnhancedAnalysis } from "@0xsignal/shared";
import type { ApiError, NetworkError } from "./errors";

const CACHE_TTL = Duration.minutes(2);
const CACHE_CAPACITY = 100;

const topAnalysisCache = Cache.make({
  capacity: CACHE_CAPACITY,
  timeToLive: CACHE_TTL,
  lookup: (limit: number) =>
    pipe(
      ApiService,
      Effect.flatMap((api) => api.getTopAnalysis(limit))
    ),
});

const analysisCache = Cache.make({
  capacity: CACHE_CAPACITY,
  timeToLive: CACHE_TTL,
  lookup: (symbol: string) =>
    pipe(
      ApiService,
      Effect.flatMap((api) => api.getAnalysis(symbol))
    ),
});

const chartDataCache = Cache.make({
  capacity: CACHE_CAPACITY,
  timeToLive: CACHE_TTL,
  lookup: (key: string) => {
    const [symbol, interval, timeframe] = key.split("|");
    return pipe(
      ApiService,
      Effect.flatMap((api) => api.getChartData(symbol, interval, timeframe))
    );
  },
});

export const getCachedTopAnalysis = (
  limit = 20
): Effect.Effect<EnhancedAnalysis[], ApiError | NetworkError, ApiService> =>
  Effect.gen(function* () {
    const cache = yield* topAnalysisCache;
    return yield* cache.get(limit);
  });

export const getCachedAnalysis = (
  symbol: string
): Effect.Effect<EnhancedAnalysis, ApiError | NetworkError, ApiService> =>
  Effect.gen(function* () {
    const cache = yield* analysisCache;
    return yield* cache.get(symbol);
  });

export const getCachedChartData = (
  symbol: string,
  interval: string,
  timeframe: string
): Effect.Effect<ChartDataPoint[], ApiError | NetworkError, ApiService> =>
  Effect.gen(function* () {
    const cache = yield* chartDataCache;
    const key = `${symbol}|${interval}|${timeframe}`;
    return yield* cache.get(key);
  });

export const invalidateTopAnalysisCache = () =>
  Effect.gen(function* () {
    const cache = yield* topAnalysisCache;
    yield* cache.invalidateAll;
  });

export const invalidateAnalysisCache = (symbol: string) =>
  Effect.gen(function* () {
    const cache = yield* analysisCache;
    yield* cache.invalidate(symbol);
  });
