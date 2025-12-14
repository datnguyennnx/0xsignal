import { Effect, Context, Layer } from "effect";
import type {
  AssetAnalysis,
  MarketOverview,
  ChartDataPoint,
  MarketHeatmap,
  OpenInterestData,
  FundingRateData,
  BuybackSignal,
  BuybackOverview,
  ProtocolBuybackDetail,
  GlobalMarketData,
  TreasurySummary,
  TreasuryEntitiesResponse,
  AssetContext,
} from "@0xsignal/shared";
import { ApiError, NetworkError } from "./errors";

const API_BASE = import.meta.env.DEV ? "/api" : "http://localhost:9006/api";

export type { ChartDataPoint };

export interface ApiService {
  readonly health: () => Effect.Effect<unknown, ApiError | NetworkError>;
  readonly getGlobalMarket: () => Effect.Effect<GlobalMarketData, ApiError | NetworkError>;
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
  readonly getTreasuryEntities: () => Effect.Effect<
    TreasuryEntitiesResponse,
    ApiError | NetworkError
  >;
  readonly getTreasuryHoldings: (
    coinId: string
  ) => Effect.Effect<TreasurySummary, ApiError | NetworkError>;
  readonly getContext: (symbol: string) => Effect.Effect<AssetContext, ApiError | NetworkError>;
}

export class ApiServiceTag extends Context.Tag("ApiService")<ApiServiceTag, ApiService>() {}
export const ApiService = ApiServiceTag;

const fetchJson = <T>(
  url: string,
  options?: RequestInit
): Effect.Effect<T, ApiError | NetworkError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(url, options),
      catch: (error) =>
        new NetworkError({
          message: error instanceof Error ? error.message : "Network request failed",
        }),
    });

    if (!response.ok) {
      return yield* Effect.fail(
        new ApiError({
          message: `API request failed: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
        })
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json() as Promise<T>,
      catch: () => new NetworkError({ message: "Failed to parse response JSON" }),
    });
  });

export const ApiServiceLive = Layer.succeed(ApiServiceTag, {
  health: () => fetchJson(`${API_BASE}/health`),
  getGlobalMarket: () => fetchJson<GlobalMarketData>(`${API_BASE}/global`),
  getTopAnalysis: (limit = 20) =>
    fetchJson<AssetAnalysis[]>(`${API_BASE}/analysis/top?limit=${limit}`),
  getAnalysis: (symbol) => fetchJson<AssetAnalysis>(`${API_BASE}/analysis/${symbol}`),
  getOverview: () => fetchJson<MarketOverview>(`${API_BASE}/overview`),
  getSignals: () => fetchJson<AssetAnalysis[]>(`${API_BASE}/signals`),
  getChartData: (symbol, interval, timeframe) =>
    fetchJson<ChartDataPoint[]>(
      `${API_BASE}/chart?symbol=${symbol}&interval=${interval}&timeframe=${timeframe}`
    ),
  getHeatmap: (limit = 100) => fetchJson<MarketHeatmap>(`${API_BASE}/heatmap?limit=${limit}`),

  getTopOpenInterest: (limit = 20) =>
    fetchJson<OpenInterestData[]>(`${API_BASE}/derivatives/open-interest?limit=${limit}`),
  getOpenInterest: (symbol) =>
    fetchJson<OpenInterestData>(`${API_BASE}/derivatives/${symbol}/open-interest`),
  getFundingRate: (symbol) =>
    fetchJson<FundingRateData>(`${API_BASE}/derivatives/${symbol}/funding-rate`),
  getBuybackSignals: (limit = 50) =>
    fetchJson<BuybackSignal[]>(`${API_BASE}/buyback/signals?limit=${limit}`),
  getBuybackOverview: () => fetchJson<BuybackOverview>(`${API_BASE}/buyback/overview`),
  getProtocolBuyback: (protocol) => fetchJson<BuybackSignal>(`${API_BASE}/buyback/${protocol}`),
  getProtocolBuybackDetail: (protocol) =>
    fetchJson<ProtocolBuybackDetail>(`${API_BASE}/buyback/${protocol}/detail`),
  getTreasuryEntities: () => fetchJson<TreasuryEntitiesResponse>(`${API_BASE}/treasury/entities`),
  getTreasuryHoldings: (coinId) =>
    fetchJson<TreasurySummary>(`${API_BASE}/treasury/${coinId}/holdings`),
  getContext: (symbol) => fetchJson<AssetContext>(`${API_BASE}/context/${symbol}`),
});
