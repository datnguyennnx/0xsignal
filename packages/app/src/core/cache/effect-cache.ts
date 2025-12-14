import { Effect, Cache, Duration, Layer, Context } from "effect";
import type {
  AssetAnalysis,
  MarketOverview,
  ChartDataPoint,
  MarketHeatmap,
  BuybackOverview,
  ProtocolBuybackDetail,
  OpenInterestData,
  FundingRateData,
  GlobalMarketData,
  TreasurySummary,
  TreasuryEntitiesResponse,
  AssetContext,
} from "@0xsignal/shared";
import { ApiServiceTag } from "../api/client";
import type { ApiError, NetworkError } from "../api/errors";

const TTL = {
  REALTIME: Duration.minutes(5),
  STANDARD: Duration.minutes(10),
  STABLE: Duration.minutes(20),
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

  readonly openInterest: Cache.Cache<string, OpenInterestData, ApiError | NetworkError>;
  readonly fundingRate: Cache.Cache<string, FundingRateData, ApiError | NetworkError>;
  readonly globalMarket: Cache.Cache<"global", GlobalMarketData, ApiError | NetworkError>;
  readonly treasuryEntities: Cache.Cache<
    "entities",
    TreasuryEntitiesResponse,
    ApiError | NetworkError
  >;
  readonly treasuryHoldings: Cache.Cache<string, TreasurySummary, ApiError | NetworkError>;
  readonly context: Cache.Cache<string, AssetContext, ApiError | NetworkError>;
}

export class CacheServiceTag extends Context.Tag("CacheService")<CacheServiceTag, CacheService>() {}

const makeTopAnalysisCache = Cache.make({
  capacity: CAPACITY.SMALL,
  timeToLive: TTL.STANDARD,
  lookup: (limit: number) =>
    ApiServiceTag.pipe(
      Effect.flatMap((api) => api.getTopAnalysis(limit)),
      Effect.uninterruptible
    ),
});

const makeAnalysisCache = Cache.make({
  capacity: CAPACITY.LARGE,
  timeToLive: TTL.STANDARD,
  lookup: (symbol: string) =>
    ApiServiceTag.pipe(
      Effect.flatMap((api) => api.getAnalysis(symbol)),
      Effect.uninterruptible
    ),
});

const makeChartDataCache = Cache.make({
  capacity: CAPACITY.MEDIUM,
  timeToLive: TTL.REALTIME,
  lookup: (key: string) => {
    const [symbol, interval, timeframe] = key.split("|");
    return ApiServiceTag.pipe(
      Effect.flatMap((api) => api.getChartData(symbol, interval, timeframe)),
      Effect.uninterruptible
    );
  },
});

const makeOverviewCache = Cache.make({
  capacity: 1,
  timeToLive: TTL.STANDARD,
  lookup: (_: "overview") =>
    ApiServiceTag.pipe(
      Effect.flatMap((api) => api.getOverview()),
      Effect.uninterruptible
    ),
});

const makeHeatmapCache = Cache.make({
  capacity: CAPACITY.SMALL,
  timeToLive: TTL.STANDARD,
  lookup: (limit: number) =>
    ApiServiceTag.pipe(
      Effect.flatMap((api) => api.getHeatmap(limit)),
      Effect.uninterruptible
    ),
});

const makeBuybackOverviewCache = Cache.make({
  capacity: 1,
  timeToLive: TTL.STABLE,
  lookup: (_: "overview") => ApiServiceTag.pipe(Effect.flatMap((api) => api.getBuybackOverview())),
});

const makeBuybackDetailCache = Cache.make({
  capacity: CAPACITY.MEDIUM,
  timeToLive: TTL.STABLE,
  lookup: (protocol: string) =>
    ApiServiceTag.pipe(Effect.flatMap((api) => api.getProtocolBuybackDetail(protocol))),
});

const makeOpenInterestCache = Cache.make({
  capacity: CAPACITY.MEDIUM,
  timeToLive: TTL.REALTIME,
  lookup: (symbol: string) =>
    ApiServiceTag.pipe(Effect.flatMap((api) => api.getOpenInterest(symbol))),
});

const makeFundingRateCache = Cache.make({
  capacity: CAPACITY.MEDIUM,
  timeToLive: TTL.REALTIME,
  lookup: (symbol: string) =>
    ApiServiceTag.pipe(Effect.flatMap((api) => api.getFundingRate(symbol))),
});

const makeGlobalMarketCache = Cache.make({
  capacity: 1,
  timeToLive: TTL.REALTIME,
  lookup: (_: "global") =>
    ApiServiceTag.pipe(
      Effect.flatMap((api) => api.getGlobalMarket()),
      Effect.uninterruptible
    ),
});

const makeTreasuryEntitiesCache = Cache.make({
  capacity: 1,
  timeToLive: TTL.STABLE,
  lookup: (_: "entities") => ApiServiceTag.pipe(Effect.flatMap((api) => api.getTreasuryEntities())),
});

const makeTreasuryHoldingsCache = Cache.make({
  capacity: CAPACITY.SMALL,
  timeToLive: TTL.STABLE,
  lookup: (coinId: string) =>
    ApiServiceTag.pipe(Effect.flatMap((api) => api.getTreasuryHoldings(coinId))),
});

const makeContextCache = Cache.make({
  capacity: CAPACITY.LARGE,
  timeToLive: TTL.STANDARD,
  lookup: (symbol: string) => ApiServiceTag.pipe(Effect.flatMap((api) => api.getContext(symbol))),
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

    openInterest: makeOpenInterestCache,
    fundingRate: makeFundingRateCache,
    globalMarket: makeGlobalMarketCache,
    treasuryEntities: makeTreasuryEntitiesCache,
    treasuryHoldings: makeTreasuryHoldingsCache,
    context: makeContextCache,
  })
);

export const cachedTopAnalysis = (limit = 20) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.topAnalysis.get(limit)));

export const cachedAnalysis = (symbol: string) =>
  CacheServiceTag.pipe(
    Effect.flatMap((c) => c.analysis.get(symbol)),
    Effect.map((data) => ({ ...data, fetchedAt: new Date() }))
  );

export const cachedChartData = (symbol: string, interval: string, timeframe: string) =>
  CacheServiceTag.pipe(
    Effect.flatMap((c) => c.chartData.get(`${symbol}|${interval}|${timeframe}`))
  );

export const cachedOverview = () =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.overview.get("overview")));

export const cachedHeatmap = (limit = 100) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.heatmap.get(limit)));

export const cachedBuybackOverview = () =>
  CacheServiceTag.pipe(
    Effect.flatMap((c) => c.buybackOverview.get("overview")),
    Effect.map((data) => ({ ...data, fetchedAt: new Date() }))
  );

export const cachedBuybackDetail = (protocol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.buybackDetail.get(protocol)));

export const cachedOpenInterest = (symbol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.openInterest.get(symbol)));

export const cachedFundingRate = (symbol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.fundingRate.get(symbol)));

export const cachedGlobalMarket = () =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.globalMarket.get("global")));

export const cachedTreasuryEntities = () =>
  CacheServiceTag.pipe(
    Effect.flatMap((c) => c.treasuryEntities.get("entities")),
    Effect.map((data) => ({ ...data, fetchedAt: new Date() }))
  );

export const cachedTreasuryHoldings = (coinId: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.treasuryHoldings.get(coinId)));

export const cachedContext = (symbol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.context.get(symbol)));

export const cachedDashboardData = (analysisLimit = 100) =>
  Effect.all(
    {
      analyses: cachedTopAnalysis(analysisLimit).pipe(
        Effect.catchAll(() => Effect.succeed([] as AssetAnalysis[]))
      ),
      globalMarket: cachedGlobalMarket().pipe(
        Effect.catchAll(() => Effect.succeed(null as GlobalMarketData | null))
      ),
      overview: cachedOverview().pipe(
        Effect.catchAll(() => Effect.succeed(null as MarketOverview | null))
      ),
    },
    { concurrency: "unbounded" }
  ).pipe(
    Effect.map((data) => ({
      ...data,
      fetchedAt: new Date(),
    }))
  );

export const cachedMarketDepthData = (symbol: string) =>
  Effect.all(
    {
      openInterest: cachedOpenInterest(symbol),
      fundingRate: cachedFundingRate(symbol),
    },
    { concurrency: "unbounded" }
  ).pipe(
    Effect.map((data) => ({
      ...data,
      fetchedAt: new Date(),
    }))
  );

export const cachedMultipleAnalyses = (symbols: readonly string[]) =>
  Effect.forEach(symbols, cachedAnalysis, { concurrency: "unbounded" });

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

          c.openInterest.invalidateAll,
          c.fundingRate.invalidateAll,
          c.globalMarket.invalidateAll,
          c.treasuryEntities.invalidateAll,
          c.treasuryHoldings.invalidateAll,
          c.context.invalidateAll,
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

        openInterest: c.openInterest.size,
        fundingRate: c.fundingRate.size,
        globalMarket: c.globalMarket.size,
        treasuryEntities: c.treasuryEntities.size,
        treasuryHoldings: c.treasuryHoldings.size,
        context: c.context.size,
      })
    )
  );

export const refreshAnalysis = (symbol: string) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.analysis.refresh(symbol)));

export const refreshTopAnalysis = (limit = 20) =>
  CacheServiceTag.pipe(Effect.flatMap((c) => c.topAnalysis.refresh(limit)));
