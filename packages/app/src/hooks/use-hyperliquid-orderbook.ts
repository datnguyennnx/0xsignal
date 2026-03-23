/**
 * Hyperliquid Orderbook Hook
 * @features WebSocket realtime, nSigFigs aggregation, client-side fallback
 * @performance RAF batching, memoized callbacks
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
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
  midPrice: number;
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
  if (!price || price <= 0) return [];

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
    midPrice: bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0,
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
const MIN_SIGFIGS = 2;
const MAX_SIGFIGS = 5;
const RESUBSCRIBE_COOLDOWN_MS = 3200;

interface UseHyperliquidOrderbookOptions {
  adaptiveNSigFigs?: boolean;
  targetHalfSpan?: number | null;
  centerPrice?: number | null;
  /**
   * When set (e.g. from `L2BookNSigFigsProvider`), subscription `nSigFigs` tracks this value.
   * Use with `adaptiveNSigFigs: false` so Depth chart matches Orderbook dropdown.
   */
  controlledNSigFigs?: number;
}

function computeCoverageHalfSpan(
  book: OrderbookData | null,
  centerPrice: number | null
): number | null {
  if (!book || !centerPrice || centerPrice <= 0 || !book.bids.length || !book.asks.length) {
    return null;
  }
  const farBid = book.bids[book.bids.length - 1]?.price ?? centerPrice;
  const farAsk = book.asks[book.asks.length - 1]?.price ?? centerPrice;
  return Math.max(0, Math.min(centerPrice - farBid, farAsk - centerPrice));
}

function getCoarseBooksBySigFigs(
  snapshots: Map<number, OrderbookData>,
  activeSigFigs: number
): Record<number, OrderbookData> {
  const result: Record<number, OrderbookData> = {};
  for (const [sigFigs, book] of snapshots.entries()) {
    if (sigFigs < activeSigFigs && book.bids.length > 0 && book.asks.length > 0) {
      result[sigFigs] = book;
    }
  }
  return result;
}

export function useHyperliquidOrderbook(
  symbol: string,
  enabled = true,
  options: UseHyperliquidOrderbookOptions = {}
) {
  const [fineBook, setFineBook] = useState<OrderbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSigFigs, setActiveSigFigs] = useState(DEFAULT_SIGFIGS);
  const prevSymbolRef = useRef(symbol);
  const lastResubscribeAtRef = useRef(0);
  const adaptiveDirectionRef = useRef<"out" | "in" | null>(null);
  const adaptiveDirectionCountRef = useRef(0);
  const snapshotsBySigFigsRef = useRef<Map<number, OrderbookData>>(new Map());

  const pending = useRef<OrderbookData | null>(null);
  const raf = useRef(0);

  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);

  // Clear orderbook when symbol changes - different coin = different prices!
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      prevSymbolRef.current = symbol;
      setFineBook(null);
      setActiveSigFigs(DEFAULT_SIGFIGS);
      adaptiveDirectionRef.current = null;
      adaptiveDirectionCountRef.current = 0;
      snapshotsBySigFigsRef.current = new Map();
    }
  }, [symbol]);
  const subscription = useMemo(
    () => (enabled && coin ? { type: "l2Book" as const, coin, nSigFigs: activeSigFigs } : null),
    [activeSigFigs, enabled, coin]
  );

  const schedule = useCallback((data: OrderbookData, sourceSigFigs: number) => {
    snapshotsBySigFigsRef.current.set(sourceSigFigs, data);
    pending.current = data;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      if (pending.current) {
        setFineBook(pending.current);
      }
      raf.current = 0;
    });
  }, []);

  const handleMsg = useCallback(
    (data: unknown, ch: string) => {
      if (ch !== "l2Book") return;
      const book = data as { levels: [L2BookLevel[], L2BookLevel[]] };
      if (book?.levels) schedule(processLevels(book.levels[0], book.levels[1]), activeSigFigs);
    },
    [activeSigFigs, schedule]
  );

  const ws = useHyperliquidWs({
    subscription,
    onMessage: handleMsg,
    enabled: enabled && !!symbol,
    onError: (e) => setError(e.message),
  });

  const resubscribe = useCallback(
    (nSigFigs: number) => {
      const next = Math.max(MIN_SIGFIGS, Math.min(MAX_SIGFIGS, nSigFigs));
      if (!coin || !ws.resubscribe || next === activeSigFigs) return;
      ws.resubscribe({ type: "l2Book", coin, nSigFigs: next });
      setActiveSigFigs(next);
      lastResubscribeAtRef.current = Date.now();
    },
    [activeSigFigs, coin, ws]
  );

  const controlledNSigFigs = options.controlledNSigFigs;

  useEffect(() => {
    if (controlledNSigFigs === undefined) return;
    resubscribe(controlledNSigFigs);
  }, [controlledNSigFigs, resubscribe]);

  useEffect(() => {
    if (!enabled || !options.adaptiveNSigFigs || !fineBook) {
      return;
    }
    const now = Date.now();
    if (now - lastResubscribeAtRef.current < RESUBSCRIBE_COOLDOWN_MS) {
      return;
    }

    const centerPrice = options.centerPrice ?? fineBook.midPrice ?? null;
    const coverageHalfSpan = computeCoverageHalfSpan(fineBook, centerPrice);
    const targetHalfSpan = options.targetHalfSpan;
    if (!coverageHalfSpan || !targetHalfSpan || targetHalfSpan <= 0) {
      adaptiveDirectionRef.current = null;
      adaptiveDirectionCountRef.current = 0;
      return;
    }

    const zoomOutNeedMoreCoverage = targetHalfSpan > coverageHalfSpan * 1.24;
    const zoomInNeedsMoreDetail = targetHalfSpan < coverageHalfSpan * 0.45;
    const direction: "out" | "in" | null = zoomOutNeedMoreCoverage
      ? "out"
      : zoomInNeedsMoreDetail
        ? "in"
        : null;
    if (!direction) {
      adaptiveDirectionRef.current = null;
      adaptiveDirectionCountRef.current = 0;
      return;
    }

    if (adaptiveDirectionRef.current === direction) {
      adaptiveDirectionCountRef.current += 1;
    } else {
      adaptiveDirectionRef.current = direction;
      adaptiveDirectionCountRef.current = 1;
    }
    if (adaptiveDirectionCountRef.current < 2) {
      return;
    }

    adaptiveDirectionRef.current = null;
    adaptiveDirectionCountRef.current = 0;
    if (direction === "out" && activeSigFigs > MIN_SIGFIGS) {
      resubscribe(activeSigFigs - 1);
      return;
    }
    if (direction === "in" && activeSigFigs < MAX_SIGFIGS) {
      resubscribe(activeSigFigs + 1);
    }
  }, [
    activeSigFigs,
    enabled,
    options.adaptiveNSigFigs,
    options.centerPrice,
    options.targetHalfSpan,
    fineBook,
    resubscribe,
  ]);

  const coarseBookBySigFigs = useMemo(
    () => getCoarseBooksBySigFigs(snapshotsBySigFigsRef.current, activeSigFigs),
    [activeSigFigs, fineBook]
  );
  const orderbook = fineBook;

  return {
    orderbook,
    fineBook,
    coarseBookBySigFigs,
    isConnected: ws.isConnected,
    error,
    resubscribe,
    activeSigFigs,
  };
}
