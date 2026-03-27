/**
 * @overview Hyperliquid Data Utilities
 *
 * Provides shared logic for mapping and transforming Hyperliquid specific data formats.
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
 */
export function processRawL2Levels(rawBids: L2BookLevel[], rawAsks: L2BookLevel[]): OrderbookData {
  const toLevels = (arr: L2BookLevel[], desc = false) => {
    const sorted = [...arr].sort((a, b) =>
      desc ? parseFloat(b.px) - parseFloat(a.px) : parseFloat(a.px) - parseFloat(b.px)
    );
    let total = 0;
    return sorted.map((l) => ({
      price: parseFloat(l.px),
      size: parseFloat(l.sz),
      total: (total += parseFloat(l.sz)),
      depth: 0,
    }));
  };

  const bids = toLevels(rawBids, true);
  const asks = toLevels(rawAsks, false);
  const max = Math.max(
    bids.reduce((s, b) => s + b.size, 0),
    asks.reduce((s, a) => s + a.size, 0),
    1
  );
  bids.forEach((b) => (b.depth = (b.total / max) * 100));
  asks.forEach((a) => (a.depth = (a.total / max) * 100));

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
 */
export function groupOrderbookLevels(
  levels: OrderbookLevel[],
  step: number,
  side: "bids" | "asks"
): OrderbookLevel[] {
  if (!levels.length || step <= 0) return levels;

  const grouped = new Map<number, number>();
  const inv = 1 / step;

  for (const l of levels) {
    const p = side === "bids" ? Math.floor(l.price * inv) / inv : Math.ceil(l.price * inv) / inv;
    const key = Number(p.toFixed(Math.max(0, -Math.floor(Math.log10(step)))));
    grouped.set(key, (grouped.get(key) || 0) + l.size);
  }

  const sorted = [...grouped.entries()].sort((a, b) =>
    side === "bids" ? b[0] - a[0] : a[0] - b[0]
  );
  let total = 0;
  const totalSize = sorted.reduce((s, [, v]) => s + v, 0);
  return sorted.map(([price, size]) => ({
    price,
    size,
    total: (total += size),
    depth: totalSize ? (total / totalSize) * 100 : 0,
  }));
}
