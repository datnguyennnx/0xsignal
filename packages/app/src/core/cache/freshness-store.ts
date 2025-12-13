/** Data Freshness Store - Tracks when data was last fetched */

// Simple in-memory store for data freshness timestamps
const fetchTimestamps = new Map<string, number>();

export type DataKey =
  | "dashboard"
  | "globalMarket"
  | "treasury"
  | "buyback"
  | "heatmap"
  | `analysis:${string}`
  | `chart:${string}`
  | `context:${string}`;

/** Record a successful data fetch */
export function recordFetch(key: DataKey): void {
  fetchTimestamps.set(key, Date.now());
}

/** Get the timestamp of the last successful fetch */
export function getFetchTimestamp(key: DataKey): number | null {
  return fetchTimestamps.get(key) ?? null;
}

/** Get the age of data in minutes */
export function getDataAgeMinutes(key: DataKey): number {
  const timestamp = fetchTimestamps.get(key);
  if (!timestamp) return 0;
  return Math.floor((Date.now() - timestamp) / 60000);
}

/** Check if data is stale (>5 min) */
export function isDataStale(key: DataKey, thresholdMinutes: number = 5): boolean {
  return getDataAgeMinutes(key) >= thresholdMinutes;
}

/** Clear all timestamps (for testing/reset) */
export function clearFetchTimestamps(): void {
  fetchTimestamps.clear();
}

/** Get all tracked keys (for debugging) */
export function getAllTrackedKeys(): string[] {
  return Array.from(fetchTimestamps.keys());
}
