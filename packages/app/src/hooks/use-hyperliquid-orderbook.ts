import { useState, useCallback, useRef, useMemo } from "react";
import {
  useHyperliquidWs,
  normalizeSymbol,
  type HyperliquidSubscription,
} from "./use-hyperliquid-ws";

// ─── Types ───────────────────────────────────────────────────
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
}

interface L2BookLevel {
  px: string;
  sz: string;
  n: number;
}

// ─── Tick Size Scaling ───────────────────────────────────────

export interface TickSizeOption {
  value: number;
  label: string;
  /** nSigFigs parameter for server-side aggregation (null = client-side only) */
  nSigFigs: number | null;
  /** mantissa parameter (only valid when nSigFigs = 5) */
  mantissa: number | null;
}

/**
 * Generate tick size options from the current best price.
 * Maps UI tick sizes to Hyperliquid's nSigFigs for server-side aggregation.
 */
export function generateTickSizeOptions(price: number): TickSizeOption[] {
  if (price <= 0) return [{ value: 1, label: "1", nSigFigs: 5, mantissa: null }];

  const magnitude = Math.pow(10, Math.floor(Math.log10(price)));
  const baseTick = magnitude / 100_000;

  const multipliers = [1, 10, 100, 1_000, 10_000, 100_000];
  return multipliers.map((m) => {
    const val = baseTick * m;
    let nSigFigs: number | null = null;
    const mantissa: number | null = null;

    // Hyperliquid supports nSigFigs between 2 and 5
    if (m === 1) nSigFigs = 5;
    else if (m === 10) nSigFigs = 4;
    else if (m === 100) nSigFigs = 3;
    else if (m === 1_000) nSigFigs = 2;

    return {
      value: val,
      label: formatTickLabel(val),
      nSigFigs,
      mantissa,
    };
  });
}

function formatTickLabel(v: number): string {
  if (v >= 100_000) return `${v / 1_000}K`;
  if (v >= 1_000) return `${v / 1_000}K`;
  if (v >= 1) return String(v);
  const decimals = Math.max(0, -Math.floor(Math.log10(v)));
  return v.toFixed(decimals);
}

// ─── Data Processing ─────────────────────────────────────────

function processLevels(rawBids: L2BookLevel[], rawAsks: L2BookLevel[]): OrderbookData {
  let bidTotal = 0;
  const bids: OrderbookLevel[] = rawBids
    .sort((a, b) => parseFloat(b.px) - parseFloat(a.px))
    .map((l) => {
      const price = parseFloat(l.px);
      const size = parseFloat(l.sz);
      bidTotal += size;
      return { price, size, total: bidTotal, depth: 0 };
    });

  let askTotal = 0;
  const asks: OrderbookLevel[] = rawAsks
    .sort((a, b) => parseFloat(a.px) - parseFloat(b.px))
    .map((l) => {
      const price = parseFloat(l.px);
      const size = parseFloat(l.sz);
      askTotal += size;
      return { price, size, total: askTotal, depth: 0 };
    });

  const maxTotal = Math.max(bidTotal, askTotal, 1);
  bids.forEach((b) => (b.depth = (b.total / maxTotal) * 100));
  asks.forEach((a) => (a.depth = (a.total / maxTotal) * 100));

  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const spread = bestAsk - bestBid;
  const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

  return { bids, asks, spread, spreadPercent };
}

/**
 * Group orderbook levels by tick size (client-side aggregation).
 * Used as a fallback when nSigFigs is too coarse.
 */
export function groupLevels(
  levels: OrderbookLevel[],
  scale: number,
  side: "bids" | "asks"
): OrderbookLevel[] {
  if (levels.length === 0 || scale <= 0) return levels;

  const grouped = new Map<number, number>();

  for (const level of levels) {
    const bucket = Math.floor(level.price / scale) * scale;
    grouped.set(bucket, (grouped.get(bucket) || 0) + level.size);
  }

  const sorted = Array.from(grouped.entries()).sort((a, b) =>
    side === "bids" ? b[0] - a[0] : a[0] - b[0]
  );

  let cumTotal = 0;
  const totalSize = sorted.reduce((s, [, sz]) => s + sz, 0);

  return sorted.map(([price, size]) => {
    cumTotal += size;
    return {
      price,
      size,
      total: cumTotal,
      depth: totalSize > 0 ? (cumTotal / totalSize) * 100 : 0,
    };
  });
}

// ─── Hook ────────────────────────────────────────────────────

const DEFAULT_SIGFIGS = 5;

export function useHyperliquidOrderbook(symbol: string, enabled: boolean = true) {
  const [orderbook, setOrderbook] = useState<OrderbookData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingRef = useRef<OrderbookData | null>(null);
  const rafRef = useRef<number | null>(null);

  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);

  // Initial subscription
  const subscription = useMemo(
    () => (enabled && coin ? { type: "l2Book" as const, coin, nSigFigs: DEFAULT_SIGFIGS } : null),
    [enabled, coin]
  );

  const scheduleUpdate = useCallback((data: OrderbookData) => {
    pendingRef.current = data;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      if (pendingRef.current) {
        setOrderbook(pendingRef.current);
        pendingRef.current = null;
      }
      rafRef.current = null;
    });
  }, []);

  const handleMessage = useCallback(
    (data: unknown, channel: string) => {
      if (channel !== "l2Book") return;
      const book = data as { levels: [L2BookLevel[], L2BookLevel[]] };
      if (!book?.levels) return;
      scheduleUpdate(processLevels(book.levels[0], book.levels[1]));
    },
    [scheduleUpdate]
  );

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
    if (!connected && rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err.message);
  }, []);

  const ws = useHyperliquidWs({
    subscription,
    onMessage: handleMessage,
    enabled: enabled && !!symbol,
    onConnectionChange: handleConnectionChange,
    onError: handleError,
  });

  const resubscribe = useCallback(
    (nSigFigs: number, mantissa?: number) => {
      if (!coin || !ws.resubscribe) return;

      const sub: HyperliquidSubscription = {
        type: "l2Book",
        coin,
        nSigFigs,
      };
      if (mantissa !== undefined && mantissa !== null) {
        sub.mantissa = mantissa;
      }
      ws.resubscribe(sub);

      // Optionally clear orderbook locally so UI handles the flash gracefully
      // but waiting for new data is usually better.
    },
    [coin, ws]
  );

  return { orderbook, isConnected, error, resubscribe };
}
