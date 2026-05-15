/**
 * @overview Market Data UI Utilities
 * @data-flow backend WS/HTTP payloads → UI adapters → processRawL2Levels
 *   → RAF batch/local state → chart + orderbook rendering
 */

// Supported time intervals
export type HLInterval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "12h"
  | "1d"
  | "1w";

/**
 * Maps a generic interval string (like "1h") to a supported backend market interval.
 */
export const mapToHLInterval = (interval: string): HLInterval =>
  (["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "1w"].includes(interval)
    ? interval
    : "1h") as HLInterval;

/**
 * Converts an interval string to its millisecond equivalent.
 */
export const getIntervalMs = (interval: string): number => {
  const value = parseInt(interval);
  const unit = interval.slice(-1);
  const mult: Record<string, number> = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    M: 2_592_000_000,
  };
  return value * (mult[unit] || 3_600_000);
};

export function toFiniteNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Produces a stable string key for an orderbook price level.
 * Hyperliquid prices have ≤8 decimal places; toFixed(8) canonicalizes
 * floating-point representation to prevent React key instability.
 */
export function priceKey(side: "bid" | "ask", price: number): string {
  return `${side}-${price.toFixed(8)}`;
}

export interface OrderbookLevel {
  price: number;
  size: number;
  total: number;
  depth: number;
}

export interface OrderbookData {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  spread: number;
  spreadPercent: number;
  midPrice: number;
}

export interface L2BookLevel {
  px: string;
  sz: string;
  n: number;
}

/**
 * Standard processing of L2 raw data into structured levels with cumulative total and depth.
 *
 * Algorithm:
 *   1. Parse + sort: O(n log n) — optimal for comparison-based sort
 *   2. Single-pass cumulative totals: O(n)
 *   3. Single-pass depth percentages: O(n)
 *   Total time: O(n log n), Space: O(n) for output only (no intermediate arrays)
 */
export function processRawL2Levels(rawBids: L2BookLevel[], rawAsks: L2BookLevel[]): OrderbookData {
  const bids = rawBids
    .map((l) => ({ price: parseFloat(l.px), size: parseFloat(l.sz), total: 0, depth: 0 }))
    .sort((a, b) => b.price - a.price);

  const asks = rawAsks
    .map((l) => ({ price: parseFloat(l.px), size: parseFloat(l.sz), total: 0, depth: 0 }))
    .sort((a, b) => a.price - b.price);

  let bidTotal = 0;
  for (let i = 0; i < bids.length; i++) {
    bidTotal += bids[i].size;
    bids[i].total = bidTotal;
  }

  let askTotal = 0;
  for (let i = 0; i < asks.length; i++) {
    askTotal += asks[i].size;
    asks[i].total = askTotal;
  }

  const maxTotal = Math.max(bidTotal, askTotal, 1);
  for (let i = 0; i < bids.length; i++) {
    bids[i].depth = (bids[i].total / maxTotal) * 100;
  }
  for (let i = 0; i < asks.length; i++) {
    asks[i].depth = (asks[i].total / maxTotal) * 100;
  }

  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  return {
    bids,
    asks,
    spread: bestAsk - bestBid,
    spreadPercent: bestBid ? ((bestAsk - bestBid) / bestBid) * 100 : 0,
    midPrice: bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0,
  };
}
