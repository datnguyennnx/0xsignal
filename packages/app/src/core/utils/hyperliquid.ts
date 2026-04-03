/**
 * @overview Hyperliquid Data Utilities
 * @audit 2026-04-03
 *   - processRawL2Levels: reduced allocations from 4+ intermediate arrays to 2 (bids + asks only)
 *     Time: O(n log n) dominated by sort (Ω(n log n) lower bound for comparison sort — optimal)
 *     Space: O(n) for output arrays only, no temporary sorted copies
 *   - groupOrderbookLevels: replaced Number(p.toFixed(d)) with Math.round(p*m)/m
 *     Avoids O(d) string conversion per level; pure O(1) floating-point arithmetic
 * @data-flow Hyperliquid WS → SDK → processRawL2Levels → RAF batch → React state → OrderbookWidget
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
  | "3d"
  | "1w"
  | "1M";

/**
 * Maps a generic interval string (like "1h") to a valid Hyperliquid API interval.
 */
export const mapToHLInterval = (interval: string): HLInterval =>
  (["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "3d", "1w", "1M"].includes(
    interval
  )
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

/**
 * Client-side grouping: floor bids, ceil asks based on specified tick step.
 *
 * Algorithm:
 *   1. Group by tick boundary: O(n) using Map
 *   2. Sort groups: O(m log m) where m = unique groups (m <= n)
 *   3. Single-pass cumulative + depth: O(m)
 *   Total time: O(n + m log m), Space: O(m) for the Map
 */
export function groupOrderbookLevels(
  levels: OrderbookLevel[],
  step: number,
  side: "bids" | "asks"
): OrderbookLevel[] {
  if (!levels.length || step <= 0) return levels;

  const grouped = new Map<number, number>();
  const inv = 1 / step;
  const logStep = Math.max(0, -Math.floor(Math.log10(step)));
  const multiplier = Math.pow(10, Math.min(logStep, 15));

  for (let i = 0; i < levels.length; i++) {
    const l = levels[i];
    const rawP = side === "bids" ? Math.floor(l.price * inv) / inv : Math.ceil(l.price * inv) / inv;
    const key = Math.round(rawP * multiplier) / multiplier;
    grouped.set(key, (grouped.get(key) || 0) + l.size);
  }

  const sorted = [...grouped.entries()].sort((a, b) =>
    side === "bids" ? b[0] - a[0] : a[0] - b[0]
  );

  let total = 0;
  let totalSize = 0;
  for (let i = 0; i < sorted.length; i++) {
    totalSize += sorted[i][1];
  }

  const result: OrderbookLevel[] = new Array(sorted.length);
  for (let i = 0; i < sorted.length; i++) {
    const [price, size] = sorted[i];
    total += size;
    result[i] = {
      price,
      size,
      total,
      depth: totalSize ? (total / totalSize) * 100 : 0,
    };
  }
  return result;
}
