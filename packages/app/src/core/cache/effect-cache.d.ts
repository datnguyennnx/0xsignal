import { Effect, Cache, Layer, Context } from "effect";
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
} from "@0xsignal/shared";
import { ApiServiceTag } from "../api/client";
import type { ApiError, NetworkError } from "../api/errors";
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
}
declare const CacheServiceTag_base: Context.TagClass<CacheServiceTag, "CacheService", CacheService>;
export declare class CacheServiceTag extends CacheServiceTag_base {}
export declare const CacheServiceLive: Layer.Layer<CacheServiceTag, never, ApiServiceTag>;
export declare const cachedTopAnalysis: (
  limit?: number
) => Effect.Effect<AssetAnalysis[], ApiError | NetworkError, CacheServiceTag>;
export declare const cachedAnalysis: (
  symbol: string
) => Effect.Effect<AssetAnalysis, ApiError | NetworkError, CacheServiceTag>;
export declare const cachedChartData: (
  symbol: string,
  interval: string,
  timeframe: string
) => Effect.Effect<ChartDataPoint[], ApiError | NetworkError, CacheServiceTag>;
export declare const cachedOverview: () => Effect.Effect<
  MarketOverview,
  ApiError | NetworkError,
  CacheServiceTag
>;
export declare const cachedHeatmap: (
  limit?: number
) => Effect.Effect<MarketHeatmap, ApiError | NetworkError, CacheServiceTag>;
export declare const cachedBuybackOverview: () => Effect.Effect<
  BuybackOverview,
  ApiError | NetworkError,
  CacheServiceTag
>;
export declare const cachedBuybackDetail: (
  protocol: string
) => Effect.Effect<ProtocolBuybackDetail, ApiError | NetworkError, CacheServiceTag>;
export declare const cachedLiquidationHeatmap: (
  symbol: string
) => Effect.Effect<LiquidationHeatmap, ApiError | NetworkError, CacheServiceTag>;
export declare const cachedOpenInterest: (
  symbol: string
) => Effect.Effect<OpenInterestData, ApiError | NetworkError, CacheServiceTag>;
export declare const cachedFundingRate: (
  symbol: string
) => Effect.Effect<FundingRateData, ApiError | NetworkError, CacheServiceTag>;
export declare const invalidateTopAnalysis: () => Effect.Effect<void, never, CacheServiceTag>;
export declare const invalidateAnalysis: (
  symbol: string
) => Effect.Effect<void, never, CacheServiceTag>;
export declare const invalidateChartData: (
  symbol: string,
  interval: string,
  timeframe: string
) => Effect.Effect<void, never, CacheServiceTag>;
export declare const invalidateAll: () => Effect.Effect<void, never, CacheServiceTag>;
export declare const getCacheStats: () => Effect.Effect<
  {
    topAnalysis: number;
    analysis: number;
    chartData: number;
    overview: number;
    heatmap: number;
  },
  never,
  CacheServiceTag
>;
export {};
//# sourceMappingURL=effect-cache.d.ts.map
