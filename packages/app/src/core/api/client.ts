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
  GlobalMarketData,
} from "@0xsignal/shared";
import { ApiError, NetworkError } from "./errors";

const API_BASE = import.meta.env.DEV ? "/api" : "http://localhost:9006/api";

// Re-export for convenience
export type { ChartDataPoint };

export interface ApiService {
  // Health
  readonly health: () => Effect.Effect<unknown, ApiError | NetworkError>;

  // Global Market
  readonly getGlobalMarket: () => Effect.Effect<GlobalMarketData, ApiError | NetworkError>;

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

  // Buyback
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

export class ApiServiceTag extends Context.Tag("ApiService")<ApiServiceTag, ApiService>() {}

// Keep backward compatibility
export const ApiService = ApiServiceTag;

// URL-based request deduplication Set for in-flight requests
// This prevents duplicate concurrent requests to the same endpoint
type InFlightEntry = {
  promise: Promise<unknown>;
  timestamp: number;
};

const inFlightRequests = new Map<string, InFlightEntry>();
const urlSet = new Set<string>();

// Clean up stale entries (older than 30 seconds)
const cleanupStaleEntries = () => {
  const now = Date.now();
  for (const [key, entry] of inFlightRequests.entries()) {
    if (now - entry.timestamp > 30000) {
      inFlightRequests.delete(key);
      urlSet.delete(key);
    }
  }
};

// Run cleanup every 10 seconds
if (typeof window !== "undefined") {
  setInterval(cleanupStaleEntries, 10000);
}

// Core fetch function with deduplication
const fetchWithDedup = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const cacheKey = `${options?.method || "GET"}:${url}`;

  // Check if request is already in-flight using urlSet
  if (urlSet.has(cacheKey)) {
    const existing = inFlightRequests.get(cacheKey);
    if (existing) {
      return existing.promise as Promise<T>;
    }
  }

  // Mark URL as in-flight
  urlSet.add(cacheKey);

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new ApiError({
          message: `API request failed: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
        });
      }

      return (await response.json()) as T;
    } finally {
      // Clean up after request completes
      urlSet.delete(cacheKey);
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, {
    promise: fetchPromise,
    timestamp: Date.now(),
  });

  return fetchPromise;
};

// Deduplicated fetch wrapped in Effect
const fetchJsonDeduped = <T>(
  url: string,
  options?: RequestInit
): Effect.Effect<T, ApiError | NetworkError> =>
  Effect.tryPromise({
    try: () => fetchWithDedup<T>(url, options),
    catch: (error) => {
      if (error instanceof ApiError) return error;
      return new NetworkError({
        message: error instanceof Error ? error.message : "Network request failed",
      });
    },
  });

// Simple fetch without deduplication (for mutations)
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
  // Health - no dedup needed
  health: () => fetchJson(`${API_BASE}/health`),

  // Global Market
  getGlobalMarket: () => fetchJsonDeduped<GlobalMarketData>(`${API_BASE}/global`),

  // Analysis - use deduped fetch for read operations
  getTopAnalysis: (limit = 20) =>
    fetchJsonDeduped<AssetAnalysis[]>(`${API_BASE}/analysis/top?limit=${limit}`),

  getAnalysis: (symbol: string) =>
    fetchJsonDeduped<AssetAnalysis>(`${API_BASE}/analysis/${symbol}`),

  getOverview: () => fetchJsonDeduped<MarketOverview>(`${API_BASE}/overview`),

  getSignals: () => fetchJsonDeduped<AssetAnalysis[]>(`${API_BASE}/signals`),

  // Chart
  getChartData: (symbol: string, interval: string, timeframe: string) =>
    fetchJsonDeduped<ChartDataPoint[]>(
      `${API_BASE}/chart?symbol=${symbol}&interval=${interval}&timeframe=${timeframe}`
    ),

  // Heatmap
  getHeatmap: (limit = 100) =>
    fetchJsonDeduped<MarketHeatmap>(`${API_BASE}/heatmap?limit=${limit}`),

  // Liquidations
  getLiquidationSummary: () =>
    fetchJsonDeduped<MarketLiquidationSummary>(`${API_BASE}/liquidations/summary`),

  getLiquidations: (symbol: string, timeframe: LiquidationTimeframe = "24h") =>
    fetchJsonDeduped<LiquidationData>(`${API_BASE}/liquidations/${symbol}?timeframe=${timeframe}`),

  getLiquidationHeatmap: (symbol: string) =>
    fetchJsonDeduped<LiquidationHeatmap>(`${API_BASE}/liquidations/${symbol}/heatmap`),

  // Derivatives
  getTopOpenInterest: (limit = 20) =>
    fetchJsonDeduped<OpenInterestData[]>(`${API_BASE}/derivatives/open-interest?limit=${limit}`),

  getOpenInterest: (symbol: string) =>
    fetchJsonDeduped<OpenInterestData>(`${API_BASE}/derivatives/${symbol}/open-interest`),

  getFundingRate: (symbol: string) =>
    fetchJsonDeduped<FundingRateData>(`${API_BASE}/derivatives/${symbol}/funding-rate`),

  // Buyback
  getBuybackSignals: (limit = 50) =>
    fetchJsonDeduped<BuybackSignal[]>(`${API_BASE}/buyback/signals?limit=${limit}`),

  getBuybackOverview: () => fetchJsonDeduped<BuybackOverview>(`${API_BASE}/buyback/overview`),

  getProtocolBuyback: (protocol: string) =>
    fetchJsonDeduped<BuybackSignal>(`${API_BASE}/buyback/${protocol}`),

  getProtocolBuybackDetail: (protocol: string) =>
    fetchJsonDeduped<ProtocolBuybackDetail>(`${API_BASE}/buyback/${protocol}/detail`),
});
