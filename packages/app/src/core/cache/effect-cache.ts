import { Effect, Cache, Duration, Layer, Context } from "effect";
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

const TTL = {
  SHORT: Duration.minutes(10),
  MEDIUM: Duration.minutes(15),
  LONG: Duration.minutes(30),
} as const;

const CAPACITY = { SMALL: 20, MEDIUM: 100, LARGE: 500 } as const;

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

const makeTopAnalysisCache = Cache.make({
  capacity: CAPACITY.SMALL,
  timeToLive: TTL.MEDIUM,
  lookup: (limit: number) => ApiServiceTag.pipe(Effect.flatMap((api) => api.getTopAnalysis(limit))),
});

const makeAnalysisCache = Cache.make({
  capacity: CAPACITY.LARGE,
  timeToLive: TTL.MEDIUM,
  lookup: (symbol: string) => ApiServiceTag.pipe(Effect.flatMap((api) => api.getAnalysis(symbol))),
});

const makeChartDataCache = Cache.make({
  capacity: CAPACITY.MEDIUM,
  timeToLive: TTL.SHORT,
  lookup: (key: string) => {
    const [symbol, interval, timeframe] = key.split("|");
    return ApiServiceTag.pipe(
      Effect.flatMap((api) => api.getChartData(symbol, interval, timeframe))
    );
  },
});

const makeOverviewCache = Cache.make({
  capacity: 1,
  timeToLive: TTL.MEDIUM,
  lookup: (_: "overview") => ApiServiceTag.pipe(Effect.flatMap((api) => api.getOverview())),
});

const makeHeatmapCache = Cache.make({
  capacity: CAPACITY.SMALL,
  timeToLive: TTL.MEDIUM,
  lookup: (limit: number) => ApiServiceTag.pipe(Effect.flatMap((api) => api.getHeatmap(limit))),
});

const makeBuybackOverviewCache = Cache.make({
  capacity: 1,
  timeToLive: TTL.MEDIUM,
  lookup: (_: "overview") => ApiServiceTag.pipe(Effect.flatMap((api) => api.getBuybackOverview())),
});

const makeBuybackDetailCache = Cache.make({
  capacity: CAPACITY.MEDIUM,
  timeToLive: TTL.MEDIUM,
  lookup: (protocol: string) =>
    ApiServiceTag.pipe(Effect.flatMap((api) => api.getProtocolBuybackDetail(protocol))),
});

const makeLiquidationHeatmapCache = Cache.make({
  capacity: CAPACITY.MEDIUM,
  timeToLive: TTL.SHORT,
  lookup: (symbol: string) =>
    ApiServiceTag.pipe(Effect.flatMap((api) => api.getLiquidationHeatmap(symbol))),
});

const makeOpenInterestCache = Cache.make({
  capacity: CAPACITY.MEDIUM,
  timeToLive: TTL.SHORT,
  lookup: (symbol: string) =>
    ApiServiceTag.pipe(Effect.flatMap((api) => api.getOpenInterest(symbol))),
});

const makeFundingRateCache = Cache.make({
  capacity: CAPACITY.MEDIUM,
  timeToLive: TTL.SHORT,
  lookup: (symbol: string) =>
    ApiServiceTag.pipe(Effect.flatMap((api) => api.getFundingRate(symbol))),
});

const makeGlobalMarketCache = Cache.make({
  capacity: 1,
  timeToLive: TTL.MEDIUM,
  lookup: (_: "global") => ApiServiceTag.pipe(Effect.flatMap((api) => api.getGlobalMarket())),
});

export const CacheServiceLive = Layer.effect(
  CacheServiceTag,
  Effect.all({
    topAnalysis: makeTopAnalysisCache,
    analysis: makeAnalysisCache,
    chartData: makeChartDataCache,
    overview: makeOverviewCache,
    heatmap: makeHeatmapCache,
    buybackOverview: makeBuybackOverviewCache,
    buybackDetail: makeBuybackDetailCache,
    liquidationHeatmap: makeLiquidationHeatmapCache,
    openInterest: makeOpenInterestCache,
    fundingRate: makeFundingRateCache,
    globalMarket: makeGlobalMarketCache,
  })
);

export const cachedTopAnalysis = (limit = 20) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.topAnalysis.get(limit)));

export const cachedAnalysis = (symbol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.analysis.get(symbol)));

export const cachedChartData = (symbol: string, interval: string, timeframe: string) =>
  CacheServiceTag.pipe(
    Effect.flatMap((c) => c.chartData.get(`${symbol}|${interval}|${timeframe}`))
  );

export const cachedOverview = () =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.overview.get("overview")));

export const cachedHeatmap = (limit = 100) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.heatmap.get(limit)));

export const cachedBuybackOverview = () =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.buybackOverview.get("overview")));

export const cachedBuybackDetail = (protocol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.buybackDetail.get(protocol)));

export const cachedLiquidationHeatmap = (symbol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.liquidationHeatmap.get(symbol)));

export const cachedOpenInterest = (symbol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.openInterest.get(symbol)));

export const cachedFundingRate = (symbol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.fundingRate.get(symbol)));

export const cachedGlobalMarket = () =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.globalMarket.get("global")));

export const cachedDashboardData = (analysisLimit = 100) =>
  Effect.all(
    {
      analyses: cachedTopAnalysis(analysisLimit),
      globalMarket: cachedGlobalMarket(),
      overview: cachedOverview(),
    },
    { concurrency: "unbounded" }
  );

export const cachedMarketDepthData = (symbol: string) =>
  Effect.all(
    {
      liquidationHeatmap: cachedLiquidationHeatmap(symbol),
      openInterest: cachedOpenInterest(symbol),
      fundingRate: cachedFundingRate(symbol),
    },
    { concurrency: "unbounded" }
  );

export const cachedMultipleAnalyses = (symbols: readonly string[]) =>
  Effect.forEach(symbols, cachedAnalysis, { concurrency: 5, batching: true });

export const invalidateTopAnalysis = () =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.topAnalysis.invalidateAll));

export const invalidateAnalysis = (symbol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.analysis.invalidate(symbol)));

export const invalidateChartData = (symbol: string, interval: string, timeframe: string) =>
  CacheServiceTag.pipe(
    Effect.flatMap((c) => c.chartData.invalidate(`${symbol}|${interval}|${timeframe}`))
  );

export const invalidateAll = () =>
  CacheServiceTag.pipe(
    Effect.flatMap((c) =>
      Effect.all(
        [
          c.topAnalysis.invalidateAll,
          c.analysis.invalidateAll,
          c.chartData.invalidateAll,
          c.overview.invalidateAll,
          c.heatmap.invalidateAll,
          c.buybackOverview.invalidateAll,
          c.buybackDetail.invalidateAll,
          c.liquidationHeatmap.invalidateAll,
          c.openInterest.invalidateAll,
          c.fundingRate.invalidateAll,
          c.globalMarket.invalidateAll,
        ],
        { concurrency: "unbounded" }
      )
    )
  );

export const getCacheStats = () =>
  CacheServiceTag.pipe(
    Effect.flatMap((c) =>
      Effect.all({
        topAnalysis: c.topAnalysis.size,
        analysis: c.analysis.size,
        chartData: c.chartData.size,
        overview: c.overview.size,
        heatmap: c.heatmap.size,
        buybackOverview: c.buybackOverview.size,
        buybackDetail: c.buybackDetail.size,
        liquidationHeatmap: c.liquidationHeatmap.size,
        openInterest: c.openInterest.size,
        fundingRate: c.fundingRate.size,
        globalMarket: c.globalMarket.size,
      })
    )
  );

export const refreshAnalysis = (symbol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.analysis.refresh(symbol)));

export const refreshTopAnalysis = (limit = 20) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.topAnalysis.refresh(limit)));
