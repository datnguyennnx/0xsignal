/**
 * Hyperliquid Orderbook Hook
 * @features WebSocket realtime, nSigFigs aggregation, client-side fallback
 * @performance RAF batching, memoized callbacks
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { useHyperliquidWs, normalizeSymbol } from "./use-hyperliquid-ws";

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

export interface TickSizeOption {
  value: number;
  label: string;
  nSigFigs: number | null;
  mantissa: number | null;
}

/** Dynamic tick size: Step = 10^(magnitude - nSigFigs + 1) */
export function generateTickSizeOptions(price: number): TickSizeOption[] {
  if (!price || price <= 0) return [{ value: 0.01, label: "0.01", nSigFigs: 5, mantissa: null }];

  const mag = Math.floor(Math.log10(price));
  const opts: TickSizeOption[] = [];

  for (const sig of [5, 4, 3, 2]) {
    const step = Number(Math.pow(10, mag - sig + 1).toPrecision(10));
    const label =
      step >= 1000
        ? `${step / 1000}K`
        : step >= 1
          ? String(step)
          : step.toFixed(Math.max(0, -Math.floor(Math.log10(step))));

    opts.push({ value: step, label, nSigFigs: sig, mantissa: null });
    if (sig === 5) opts.push({ value: step * 5, label: `${label}*`, nSigFigs: 5, mantissa: 5 });
  }
  return opts;
}

function processLevels(rawBids: L2BookLevel[], rawAsks: L2BookLevel[]): OrderbookData {
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
  };
}

/** Client-side grouping: floor bids, ceil asks */
export function groupLevels(
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

const DEFAULT_SIGFIGS = 5;

export function useHyperliquidOrderbook(symbol: string, enabled = true) {
  const [orderbook, setOrderbook] = useState<OrderbookData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = useRef<OrderbookData | null>(null);
  const raf = useRef(0);

  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const subscription = useMemo(
    () => (enabled && coin ? { type: "l2Book" as const, coin, nSigFigs: DEFAULT_SIGFIGS } : null),
    [enabled, coin]
  );

  const schedule = useCallback((data: OrderbookData) => {
    pending.current = data;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      if (pending.current) setOrderbook(pending.current);
      raf.current = 0;
    });
  }, []);

  const handleMsg = useCallback(
    (data: unknown, ch: string) => {
      if (ch !== "l2Book") return;
      const book = data as { levels: [L2BookLevel[], L2BookLevel[]] };
      if (book?.levels) schedule(processLevels(book.levels[0], book.levels[1]));
    },
    [schedule]
  );

  const ws = useHyperliquidWs({
    subscription,
    onMessage: handleMsg,
    enabled: enabled && !!symbol,
    onConnectionChange: (c) => {
      setIsConnected(c);
      if (!c && raf.current) cancelAnimationFrame(raf.current);
    },
    onError: (e) => setError(e.message),
  });

  const resubscribe = useCallback(
    (nSigFigs: number, mantissa?: number) => {
      if (!coin || !ws.resubscribe) return;
      ws.resubscribe({ type: "l2Book", coin, nSigFigs, ...(mantissa && { mantissa }) });
    },
    [coin, ws]
  );

  return { orderbook, isConnected, error, resubscribe };
}
