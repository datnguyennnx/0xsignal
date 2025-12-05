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
  TreasurySummary,
  TreasuryEntitiesResponse,
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
  readonly getTreasuryEntities: () => Effect.Effect<
    TreasuryEntitiesResponse,
    ApiError | NetworkError
  >;
  readonly getTreasuryHoldings: (
    coinId: string
  ) => Effect.Effect<TreasurySummary, ApiError | NetworkError>;
}

export class ApiServiceTag extends Context.Tag("ApiService")<ApiServiceTag, ApiService>() {}
export const ApiService = ApiServiceTag;

type InFlightEntry = { promise: Promise<unknown>; timestamp: number };
const inFlightRequests = new Map<string, InFlightEntry>();
const urlSet = new Set<string>();

const STALE_THRESHOLD_MS = 30000;
const CLEANUP_INTERVAL_MS = 10000;

const cleanupStaleEntries = () => {
  const now = Date.now();
  for (const [key, entry] of inFlightRequests.entries()) {
    if (now - entry.timestamp > STALE_THRESHOLD_MS) {
      inFlightRequests.delete(key);
      urlSet.delete(key);
    }
  }
};

if (typeof window !== "undefined") {
  setInterval(cleanupStaleEntries, CLEANUP_INTERVAL_MS);
}

const fetchWithDedup = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const cacheKey = `${options?.method || "GET"}:${url}`;

  if (urlSet.has(cacheKey)) {
    const existing = inFlightRequests.get(cacheKey);
    if (existing) return existing.promise as Promise<T>;
  }

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
      urlSet.delete(cacheKey);
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, { promise: fetchPromise, timestamp: Date.now() });
  return fetchPromise;
};

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
  getGlobalMarket: () => fetchJsonDeduped<GlobalMarketData>(`${API_BASE}/global`),
  getTopAnalysis: (limit = 20) =>
    fetchJsonDeduped<AssetAnalysis[]>(`${API_BASE}/analysis/top?limit=${limit}`),
  getAnalysis: (symbol) => fetchJsonDeduped<AssetAnalysis>(`${API_BASE}/analysis/${symbol}`),
  getOverview: () => fetchJsonDeduped<MarketOverview>(`${API_BASE}/overview`),
  getSignals: () => fetchJsonDeduped<AssetAnalysis[]>(`${API_BASE}/signals`),
  getChartData: (symbol, interval, timeframe) =>
    fetchJsonDeduped<ChartDataPoint[]>(
      `${API_BASE}/chart?symbol=${symbol}&interval=${interval}&timeframe=${timeframe}`
    ),
  getHeatmap: (limit = 100) =>
    fetchJsonDeduped<MarketHeatmap>(`${API_BASE}/heatmap?limit=${limit}`),
  getLiquidationSummary: () =>
    fetchJsonDeduped<MarketLiquidationSummary>(`${API_BASE}/liquidations/summary`),
  getLiquidations: (symbol, timeframe: LiquidationTimeframe = "24h") =>
    fetchJsonDeduped<LiquidationData>(`${API_BASE}/liquidations/${symbol}?timeframe=${timeframe}`),
  getLiquidationHeatmap: (symbol) =>
    fetchJsonDeduped<LiquidationHeatmap>(`${API_BASE}/liquidations/${symbol}/heatmap`),
  getTopOpenInterest: (limit = 20) =>
    fetchJsonDeduped<OpenInterestData[]>(`${API_BASE}/derivatives/open-interest?limit=${limit}`),
  getOpenInterest: (symbol) =>
    fetchJsonDeduped<OpenInterestData>(`${API_BASE}/derivatives/${symbol}/open-interest`),
  getFundingRate: (symbol) =>
    fetchJsonDeduped<FundingRateData>(`${API_BASE}/derivatives/${symbol}/funding-rate`),
  getBuybackSignals: (limit = 50) =>
    fetchJsonDeduped<BuybackSignal[]>(`${API_BASE}/buyback/signals?limit=${limit}`),
  getBuybackOverview: () => fetchJsonDeduped<BuybackOverview>(`${API_BASE}/buyback/overview`),
  getProtocolBuyback: (protocol) =>
    fetchJsonDeduped<BuybackSignal>(`${API_BASE}/buyback/${protocol}`),
  getProtocolBuybackDetail: (protocol) =>
    fetchJsonDeduped<ProtocolBuybackDetail>(`${API_BASE}/buyback/${protocol}/detail`),
  getTreasuryEntities: () =>
    fetchJsonDeduped<TreasuryEntitiesResponse>(`${API_BASE}/treasury/entities`),
  getTreasuryHoldings: (coinId) =>
    fetchJsonDeduped<TreasurySummary>(`${API_BASE}/treasury/${coinId}/holdings`),
});
