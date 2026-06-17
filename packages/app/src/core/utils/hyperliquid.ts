import { type WsMarketInterval, WS_MARKET_INTERVALS } from "@0xsignal/shared";

// Re-export shared interval type as the canonical interval type
export type HLInterval = WsMarketInterval;

/** @deprecated Use `WS_MARKET_INTERVALS` from `@0xsignal/shared` instead. */
const HL_INTERVALS: readonly HLInterval[] = WS_MARKET_INTERVALS;

export const mapToHLInterval = (interval: string): HLInterval =>
  HL_INTERVALS.find((v) => v === interval) ?? "1h";

export const getIntervalMs = (interval: string): number => {
  const value = parseInt(interval);
  const unit = interval.slice(-1);
  const mult: Record<string, number> = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
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

export function processRawL2Levels(
  rawBids: L2BookLevel[],
  rawAsks: L2BookLevel[],
  maxDepth = 20,
): OrderbookData {
  // HL WS delivers levels sorted: bids descending, asks ascending — no sort needed.
  const bids = rawBids.slice(0, maxDepth).map((l) => ({
    price: parseFloat(l.px),
    size: parseFloat(l.sz),
    total: 0,
  }));
  const asks = rawAsks.slice(0, maxDepth).map((l) => ({
    price: parseFloat(l.px),
    size: parseFloat(l.sz),
    total: 0,
  }));

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
