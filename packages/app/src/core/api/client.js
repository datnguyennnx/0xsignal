import { Effect, Context, Layer } from "effect";
import { ApiError, NetworkError } from "./errors";
const API_BASE = import.meta.env.DEV ? "/api" : "http://localhost:9006/api";
export class ApiServiceTag extends Context.Tag("ApiService")() {}
// Keep backward compatibility
export const ApiService = ApiServiceTag;
const inFlightRequests = new Map();
const urlSet = new Set();
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
const fetchWithDedup = async (url, options) => {
  const cacheKey = `${options?.method || "GET"}:${url}`;
  // Check if request is already in-flight using urlSet
  if (urlSet.has(cacheKey)) {
    const existing = inFlightRequests.get(cacheKey);
    if (existing) {
      return existing.promise;
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
      return await response.json();
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
const fetchJsonDeduped = (url, options) =>
  Effect.tryPromise({
    try: () => fetchWithDedup(url, options),
    catch: (error) => {
      if (error instanceof ApiError) return error;
      return new NetworkError({
        message: error instanceof Error ? error.message : "Network request failed",
      });
    },
  });
// Simple fetch without deduplication (for mutations)
const fetchJson = (url, options) =>
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
      try: () => response.json(),
      catch: () => new NetworkError({ message: "Failed to parse response JSON" }),
    });
  });
export const ApiServiceLive = Layer.succeed(ApiServiceTag, {
  // Health - no dedup needed
  health: () => fetchJson(`${API_BASE}/health`),
  // Analysis - use deduped fetch for read operations
  getTopAnalysis: (limit = 20) => fetchJsonDeduped(`${API_BASE}/analysis/top?limit=${limit}`),
  getAnalysis: (symbol) => fetchJsonDeduped(`${API_BASE}/analysis/${symbol}`),
  getOverview: () => fetchJsonDeduped(`${API_BASE}/overview`),
  getSignals: () => fetchJsonDeduped(`${API_BASE}/signals`),
  // Chart
  getChartData: (symbol, interval, timeframe) =>
    fetchJsonDeduped(
      `${API_BASE}/chart?symbol=${symbol}&interval=${interval}&timeframe=${timeframe}`
    ),
  // Heatmap
  getHeatmap: (limit = 100) => fetchJsonDeduped(`${API_BASE}/heatmap?limit=${limit}`),
  // Liquidations
  getLiquidationSummary: () => fetchJsonDeduped(`${API_BASE}/liquidations/summary`),
  getLiquidations: (symbol, timeframe = "24h") =>
    fetchJsonDeduped(`${API_BASE}/liquidations/${symbol}?timeframe=${timeframe}`),
  getLiquidationHeatmap: (symbol) => fetchJsonDeduped(`${API_BASE}/liquidations/${symbol}/heatmap`),
  // Derivatives
  getTopOpenInterest: (limit = 20) =>
    fetchJsonDeduped(`${API_BASE}/derivatives/open-interest?limit=${limit}`),
  getOpenInterest: (symbol) => fetchJsonDeduped(`${API_BASE}/derivatives/${symbol}/open-interest`),
  getFundingRate: (symbol) => fetchJsonDeduped(`${API_BASE}/derivatives/${symbol}/funding-rate`),
  // Buyback
  getBuybackSignals: (limit = 50) => fetchJsonDeduped(`${API_BASE}/buyback/signals?limit=${limit}`),
  getBuybackOverview: () => fetchJsonDeduped(`${API_BASE}/buyback/overview`),
  getProtocolBuyback: (protocol) => fetchJsonDeduped(`${API_BASE}/buyback/${protocol}`),
  getProtocolBuybackDetail: (protocol) =>
    fetchJsonDeduped(`${API_BASE}/buyback/${protocol}/detail`),
});
//# sourceMappingURL=client.js.map
