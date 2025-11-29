import { Effect, Context, Layer } from "effect";
import type {
  AssetAnalysis,
  MarketOverview,
  ChartDataPoint,
  MarketHeatmap,
  MarketLiquidationSummary,
  LiquidationHeatmap,
  LiquidationData,
  OpenInterestData,
  FundingRateData,
  LiquidationTimeframe,
  BuybackSignal,
  BuybackOverview,
  ProtocolBuybackDetail,
} from "@0xsignal/shared";
import { ApiError, NetworkError } from "./errors";
export type { ChartDataPoint };
export interface ApiService {
  readonly health: () => Effect.Effect<unknown, ApiError | NetworkError>;
  readonly getTopAnalysis: (
    limit?: number
  ) => Effect.Effect<AssetAnalysis[], ApiError | NetworkError>;
  readonly getAnalysis: (symbol: string) => Effect.Effect<AssetAnalysis, ApiError | NetworkError>;
  readonly getOverview: () => Effect.Effect<MarketOverview, ApiError | NetworkError>;
  readonly getSignals: () => Effect.Effect<AssetAnalysis[], ApiError | NetworkError>;
  readonly getChartData: (
    symbol: string,
    interval: string,
    timeframe: string
  ) => Effect.Effect<ChartDataPoint[], ApiError | NetworkError>;
  readonly getHeatmap: (limit?: number) => Effect.Effect<MarketHeatmap, ApiError | NetworkError>;
  readonly getLiquidationSummary: () => Effect.Effect<
    MarketLiquidationSummary,
    ApiError | NetworkError
  >;
  readonly getLiquidations: (
    symbol: string,
    timeframe?: LiquidationTimeframe
  ) => Effect.Effect<LiquidationData, ApiError | NetworkError>;
  readonly getLiquidationHeatmap: (
    symbol: string
  ) => Effect.Effect<LiquidationHeatmap, ApiError | NetworkError>;
  readonly getTopOpenInterest: (
    limit?: number
  ) => Effect.Effect<OpenInterestData[], ApiError | NetworkError>;
  readonly getOpenInterest: (
    symbol: string
  ) => Effect.Effect<OpenInterestData, ApiError | NetworkError>;
  readonly getFundingRate: (
    symbol: string
  ) => Effect.Effect<FundingRateData, ApiError | NetworkError>;
  readonly getBuybackSignals: (
    limit?: number
  ) => Effect.Effect<BuybackSignal[], ApiError | NetworkError>;
  readonly getBuybackOverview: () => Effect.Effect<BuybackOverview, ApiError | NetworkError>;
  readonly getProtocolBuyback: (
    protocol: string
  ) => Effect.Effect<BuybackSignal, ApiError | NetworkError>;
  readonly getProtocolBuybackDetail: (
    protocol: string
  ) => Effect.Effect<ProtocolBuybackDetail, ApiError | NetworkError>;
}
declare const ApiServiceTag_base: Context.TagClass<ApiServiceTag, "ApiService", ApiService>;
export declare class ApiServiceTag extends ApiServiceTag_base {}
export declare const ApiService: typeof ApiServiceTag;
export declare const ApiServiceLive: Layer.Layer<ApiServiceTag, never, never>;
//# sourceMappingURL=client.d.ts.map
