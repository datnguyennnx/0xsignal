import { Effect, Context, Layer } from "effect";
import type { AssetAnalysis, MarketOverview, ChartDataPoint } from "@0xsignal/shared";
import { ApiError, NetworkError } from "./errors";

const API_BASE = import.meta.env.DEV ? "/api" : "http://localhost:9006/api";

// Re-export for convenience
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
}

export class ApiServiceTag extends Context.Tag("ApiService")<ApiServiceTag, ApiService>() {}

// Keep backward compatibility
export const ApiService = ApiServiceTag;

const fetchJson = <T>(
  url: string,
  options?: RequestInit
): Effect.Effect<T, ApiError | NetworkError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new ApiError({
          message: `API request failed: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
        });
      }

      return (await response.json()) as T;
    },
    catch: (error) => {
      if (error instanceof ApiError) {
        return error;
      }
      return new NetworkError({
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    },
  });

export const ApiServiceLive = Layer.succeed(ApiServiceTag, {
  health: () => fetchJson(`${API_BASE}/health`),

  getTopAnalysis: (limit = 20) =>
    fetchJson<AssetAnalysis[]>(`${API_BASE}/analysis/top?limit=${limit}`),

  getAnalysis: (symbol: string) => fetchJson<AssetAnalysis>(`${API_BASE}/analysis/${symbol}`),

  getOverview: () => fetchJson<MarketOverview>(`${API_BASE}/overview`),

  getSignals: () => fetchJson<AssetAnalysis[]>(`${API_BASE}/signals`),

  getChartData: (symbol: string, interval: string, timeframe: string) =>
    fetchJson<ChartDataPoint[]>(
      `${API_BASE}/chart?symbol=${symbol}&interval=${interval}&timeframe=${timeframe}`
    ),
});
