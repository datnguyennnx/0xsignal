import { Effect, Context, Layer } from "effect";
import type { EnhancedAnalysis } from "@0xsignal/shared";
import { ApiError, NetworkError } from "./errors";

const API_BASE = import.meta.env.DEV ? "/api" : "http://localhost:9006/api";

export interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class ApiService extends Context.Tag("ApiService")<
  ApiService,
  {
    readonly health: () => Effect.Effect<unknown, ApiError | NetworkError>;
    readonly getTopAnalysis: (
      limit?: number
    ) => Effect.Effect<EnhancedAnalysis[], ApiError | NetworkError>;
    readonly getAnalysis: (
      symbol: string
    ) => Effect.Effect<EnhancedAnalysis, ApiError | NetworkError>;
    readonly getOverview: () => Effect.Effect<any, ApiError | NetworkError>;
    readonly getSignals: () => Effect.Effect<EnhancedAnalysis[], ApiError | NetworkError>;
    readonly getChartData: (
      symbol: string,
      interval: string,
      timeframe: string
    ) => Effect.Effect<ChartDataPoint[], ApiError | NetworkError>;
  }
>() {}

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

export const ApiServiceLive = Layer.succeed(ApiService, {
  health: () => fetchJson(`${API_BASE}/health`),

  getTopAnalysis: (limit = 20) =>
    fetchJson<EnhancedAnalysis[]>(`${API_BASE}/analysis/top?limit=${limit}`),

  getAnalysis: (symbol: string) => fetchJson<EnhancedAnalysis>(`${API_BASE}/analysis/${symbol}`),

  getOverview: () => fetchJson(`${API_BASE}/overview`),

  getSignals: () => fetchJson<EnhancedAnalysis[]>(`${API_BASE}/signals`),

  getChartData: (symbol: string, interval: string, timeframe: string) =>
    fetchJson<ChartDataPoint[]>(
      `${API_BASE}/chart?symbol=${symbol}&interval=${interval}&timeframe=${timeframe}`
    ),
});
