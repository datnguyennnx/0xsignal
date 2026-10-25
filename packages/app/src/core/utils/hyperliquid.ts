import { type WsMarketInterval, WS_MARKET_INTERVALS } from "@0xsignal/shared";

// Re-export shared interval type as the canonical interval type
export type HLInterval = WsMarketInterval;

export const mapToHLInterval = (interval: string): HLInterval =>
  WS_MARKET_INTERVALS.find((v) => v === interval) ?? "1h";

export const getIntervalMs = (interval: string): number => {
  const value = Number(interval.replace(/[a-z]$/i, ""));
  const unit = interval.slice(-1);
  const mult: Record<string, number> = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  return value * (mult[unit] || 3_600_000);
};

/**
 * Produces a stable string key for an orderbook price level.
 * Hyperliquid prices have ≤8 decimal places; toFixed(8) canonicalizes
 * floating-point representation to prevent React key instability.
 */
export function priceKey(side: "bid" | "ask", price: number): string {
  return `${side}-${price.toFixed(8)}`;
}

export interface DisplayOrderbookLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderbookData {
  bids: DisplayOrderbookLevel[];
  asks: DisplayOrderbookLevel[];
  spread: number;
  spreadPercent: number;
  midPrice: number;
}

export interface L2BookLevel {
  px: string;
  sz: string;
  n: number;
}

/** The protocol ceiling: l2Book sends at most 20 levels per side (5 on fast). */
export const MAX_BOOK_DEPTH = 20;

const isPriceOrdered = (levels: readonly DisplayOrderbookLevel[], descending: boolean): boolean => {
  for (let i = 1; i < levels.length; i += 1) {
    const previous = levels[i - 1].price;
    const current = levels[i].price;
    if (descending ? current > previous : current < previous) return false;
  }
  return true;
};

function buildSide(
  raw: readonly L2BookLevel[],
  descending: boolean,
  maxDepth: number,
): DisplayOrderbookLevel[] {
  // One allocation per level: parse, order, and truncate in a single pass.
  const levels: DisplayOrderbookLevel[] = raw.map((level) => ({
    price: Number(level.px),
    size: Number(level.sz),
    total: 0,
  }));

  // Hyperliquid sends levels sorted; only pay for the sort when a delta map
  // handed us an unordered window.
  if (!isPriceOrdered(levels, descending)) {
    levels.sort(descending ? (a, b) => b.price - a.price : (a, b) => a.price - b.price);
  }
  levels.length = Math.min(levels.length, maxDepth);
  return levels;
}

export function processRawL2Levels(
  rawBids: L2BookLevel[],
  rawAsks: L2BookLevel[],
  maxDepth = MAX_BOOK_DEPTH,
): OrderbookData {
  const bids = buildSide(rawBids, true, maxDepth);
  const asks = buildSide(rawAsks, false, maxDepth);

  // Cumulative totals are computed exactly once per update, not per render.

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
