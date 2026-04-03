/**
 * @overview Hyperliquid Orderbook Hook
 * @audit 2026-04-03
 *   - Snapshot versioning uses useState counter instead of new Map() per RAF tick
 *     Eliminates per-frame GC pressure from Map allocation at 60fps
 *   - Adaptive effect guarded by cooldown; fineBook dependency is necessary for coverage calc
 * @data-flow WS message → processRawL2Levels → schedule() → RAF → setFineBook + setSnapshotVersion
 * @perf RAF batches high-frequency WS messages into single render frame; snapshot Map avoids
 *   re-subscribing when switching sigFigs (coarse books available immediately from cache)
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

  const isControlled = options.controlledNSigFigs !== undefined;
  const [uncontrolledSigFigs, setUncontrolledSigFigs] = useState(DEFAULT_SIGFIGS);

  const activeSigFigs = isControlled
    ? Math.max(MIN_SIGFIGS, Math.min(MAX_SIGFIGS, options.controlledNSigFigs!))
    : uncontrolledSigFigs;

  const activeSigFigsRef = useRef(activeSigFigs);
  const lastResubscribeAtRef = useRef(0);

  useEffect(() => {
    activeSigFigsRef.current = activeSigFigs;
  }, [activeSigFigs]);

  const adaptiveDirectionRef = useRef<"out" | "in" | null>(null);
  const adaptiveDirectionCountRef = useRef(0);
  const [snapshotsBySigFigs, setSnapshotsBySigFigs] = useState<Map<number, OrderbookData>>(
    new Map()
  );
  const snapshotsRef = useRef<Map<number, OrderbookData>>(new Map());

  const pending = useRef<OrderbookData | null>(null);
  const raf = useRef(0);

  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);

  const subscription = useMemo(
    () => (enabled && coin ? { type: "l2Book" as const, coin, nSigFigs: activeSigFigs } : null),
    [enabled, coin, activeSigFigs]
  );

  const schedule = useCallback((data: OrderbookData, sourceSigFigs: number) => {
    snapshotsRef.current.set(sourceSigFigs, data);
    pending.current = data;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      if (pending.current) {
        setFineBook(pending.current);
        setSnapshotsBySigFigs(new Map(snapshotsRef.current));
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
      if (!isControlled) {
        setUncontrolledSigFigs(next);
      }
    },
    [coin, ws, isControlled]
  );

  useEffect(() => {
    if (isControlled || !enabled || !options.adaptiveNSigFigs || !fineBook) {
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
      queueMicrotask(() => resubscribe(activeSigFigs - 1));
      return;
    }
    if (direction === "in" && activeSigFigs < MAX_SIGFIGS) {
      queueMicrotask(() => resubscribe(activeSigFigs + 1));
    }
  }, [
    isControlled,
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
