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
} from "@0xsignal/shared";
import { ApiError, NetworkError } from "./errors";

const API_BASE = import.meta.env.DEV ? "/api" : "http://localhost:9006/api";

// Re-export for convenience
export type { ChartDataPoint };

export interface ApiService {
  // Health
  readonly health: () => Effect.Effect<unknown, ApiError | NetworkError>;

  // Analysis
  readonly getTopAnalysis: (
    limit?: number
  ) => Effect.Effect<AssetAnalysis[], ApiError | NetworkError>;
  readonly getAnalysis: (symbol: string) => Effect.Effect<AssetAnalysis, ApiError | NetworkError>;
  readonly getOverview: () => Effect.Effect<MarketOverview, ApiError | NetworkError>;
  readonly getSignals: () => Effect.Effect<AssetAnalysis[], ApiError | NetworkError>;

  // Chart
  readonly getChartData: (
    symbol: string,
    interval: string,
    timeframe: string
  ) => Effect.Effect<ChartDataPoint[], ApiError | NetworkError>;

  // Heatmap
  readonly getHeatmap: (limit?: number) => Effect.Effect<MarketHeatmap, ApiError | NetworkError>;

  // Liquidations
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

  // Derivatives
  readonly getTopOpenInterest: (
    limit?: number
  ) => Effect.Effect<OpenInterestData[], ApiError | NetworkError>;
  readonly getOpenInterest: (
    symbol: string
  ) => Effect.Effect<OpenInterestData, ApiError | NetworkError>;
  readonly getFundingRate: (
    symbol: string
  ) => Effect.Effect<FundingRateData, ApiError | NetworkError>;
}

export class ApiServiceTag extends Context.Tag("ApiService")<ApiServiceTag, ApiService>() {}

// Keep backward compatibility
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
  // Health
  health: () => fetchJson(`${API_BASE}/health`),

  // Analysis
  getTopAnalysis: (limit = 20) =>
    fetchJson<AssetAnalysis[]>(`${API_BASE}/analysis/top?limit=${limit}`),

  getAnalysis: (symbol: string) => fetchJson<AssetAnalysis>(`${API_BASE}/analysis/${symbol}`),

  getOverview: () => fetchJson<MarketOverview>(`${API_BASE}/overview`),

  getSignals: () => fetchJson<AssetAnalysis[]>(`${API_BASE}/signals`),

  // Chart
  getChartData: (symbol: string, interval: string, timeframe: string) =>
    fetchJson<ChartDataPoint[]>(
      `${API_BASE}/chart?symbol=${symbol}&interval=${interval}&timeframe=${timeframe}`
    ),

  // Heatmap
  getHeatmap: (limit = 100) => fetchJson<MarketHeatmap>(`${API_BASE}/heatmap?limit=${limit}`),

  // Liquidations
  getLiquidationSummary: () =>
    fetchJson<MarketLiquidationSummary>(`${API_BASE}/liquidations/summary`),

  getLiquidations: (symbol: string, timeframe: LiquidationTimeframe = "24h") =>
    fetchJson<LiquidationData>(`${API_BASE}/liquidations/${symbol}?timeframe=${timeframe}`),

  getLiquidationHeatmap: (symbol: string) =>
    fetchJson<LiquidationHeatmap>(`${API_BASE}/liquidations/${symbol}/heatmap`),

  // Derivatives
  getTopOpenInterest: (limit = 20) =>
    fetchJson<OpenInterestData[]>(`${API_BASE}/derivatives/open-interest?limit=${limit}`),

  getOpenInterest: (symbol: string) =>
    fetchJson<OpenInterestData>(`${API_BASE}/derivatives/${symbol}/open-interest`),

  getFundingRate: (symbol: string) =>
    fetchJson<FundingRateData>(`${API_BASE}/derivatives/${symbol}/funding-rate`),
});
