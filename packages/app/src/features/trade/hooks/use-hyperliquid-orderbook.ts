/**
 * @overview Hyperliquid Orderbook Hook
 *
 * Provides real-time L2 orderbook data with support for dynamic aggregation (nSigFigs).
 * Supports both adaptive (auto-zoom based on coverage) and controlled aggregation.
 *
 * @mechanism
 * - Uses RAF-throttled updates to batch high-frequency WebSocket messages
 * - Implements client-side grouping and depth calculation for UI rendering
 * - Maintains snapshots at different sigfigs to allow smooth transitions
 *
 * @performance RAF batching, memoized callbacks, and efficient array processing.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useHyperliquidWs, normalizeSymbol } from "./use-hyperliquid-ws";
import { processRawL2Levels, type OrderbookData, type L2BookLevel } from "@/core/utils/hyperliquid";

export interface TickSizeOption {
  value: number;
  label: string;
  nSigFigs: number | null;
  mantissa: number | null;
}

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
  const activeSigFigsRef = useRef(activeSigFigs);
  const prevSymbolRef = useRef(symbol);
  const lastResubscribeAtRef = useRef(0);
  useEffect(() => {
    activeSigFigsRef.current = activeSigFigs;
    lastResubscribeAtRef.current = Date.now();
  }, [activeSigFigs]);
  const adaptiveDirectionRef = useRef<"out" | "in" | null>(null);
  const adaptiveDirectionCountRef = useRef(0);
  const [snapshotsBySigFigs, setSnapshotsBySigFigs] = useState<Map<number, OrderbookData>>(
    new Map()
  );
  const snapshotsBySigFigsRef = useRef<Map<number, OrderbookData>>(new Map());

  const pending = useRef<OrderbookData | null>(null);
  const raf = useRef(0);

  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);

  // Clear orderbook when symbol changes - different coin = different prices!
  const [prevSymbol, setPrevSymbol] = useState(symbol);
  if (symbol !== prevSymbol) {
    setPrevSymbol(symbol);
    setFineBook(null);
    setActiveSigFigs(DEFAULT_SIGFIGS);
    setSnapshotsBySigFigs(new Map());
  }

  // Ref updates must happen outside of the render phase
  useEffect(() => {
    if (symbol !== prevSymbolRef.current) {
      prevSymbolRef.current = symbol;
      adaptiveDirectionRef.current = null;
      adaptiveDirectionCountRef.current = 0;
      snapshotsBySigFigsRef.current = new Map();
      pending.current = null;
    }
  }, [symbol]);

  const subscription = useMemo(
    () => (enabled && coin ? { type: "l2Book" as const, coin, nSigFigs: activeSigFigs } : null),
    [enabled, coin, activeSigFigs]
  );

  const schedule = useCallback((data: OrderbookData, sourceSigFigs: number) => {
    snapshotsBySigFigsRef.current.set(sourceSigFigs, data);
    pending.current = data;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      if (pending.current) {
        setFineBook(pending.current);
        setSnapshotsBySigFigs(new Map(snapshotsBySigFigsRef.current));
      }
      raf.current = 0;
    });
  }, []);

  const handleMsg = useCallback(
    (data: unknown, ch: string) => {
      if (ch !== "l2Book") return;
      const book = data as { levels: [L2BookLevel[], L2BookLevel[]] };
      if (book?.levels)
        schedule(processRawL2Levels(book.levels[0], book.levels[1]), activeSigFigsRef.current);
    },
    [schedule]
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
      if (!coin || !ws.resubscribe || next === activeSigFigsRef.current) return;
      ws.resubscribe({ type: "l2Book", coin, nSigFigs: next });
      setActiveSigFigs(next);
    },
    [coin, ws]
  );

  const controlledNSigFigs = options.controlledNSigFigs;
  const [prevControlled, setPrevControlled] = useState(controlledNSigFigs);
  if (controlledNSigFigs !== undefined && controlledNSigFigs !== prevControlled) {
    setPrevControlled(controlledNSigFigs);
    if (controlledNSigFigs !== activeSigFigs) {
      const next = Math.max(MIN_SIGFIGS, Math.min(MAX_SIGFIGS, controlledNSigFigs));
      setActiveSigFigs(next);
    }
  }

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
    if (direction === "out" && activeSigFigs > MIN_SIGFIGS) {
      setTimeout(() => resubscribe(activeSigFigs - 1), 0);
      return;
    }
    if (direction === "in" && activeSigFigs < MAX_SIGFIGS) {
      setTimeout(() => resubscribe(activeSigFigs + 1), 0);
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
    () => getCoarseBooksBySigFigs(snapshotsBySigFigs, activeSigFigs),
    [activeSigFigs, snapshotsBySigFigs]
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
