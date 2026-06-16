import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHyperliquidWs } from "./use-hyperliquid-ws";
import { normalizeSymbol } from "../lib/symbol";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
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

const DEFAULT_N_SIG_FIGS = 5;
const MIN_N_SIG_FIGS = 2;
const MAX_N_SIG_FIGS = 5;
const RESUBSCRIBE_COOLDOWN_MS = 3200;
const MAX_DEPTH = 25;

interface UseHyperliquidOrderbookOptions {
  adaptiveNSigFigs?: boolean;
  targetHalfSpan?: number | null;
  centerPrice?: number | null;
  controlledNSigFigs?: number;
}

function computeCoverageHalfSpan(
  book: OrderbookData | null,
  centerPrice: number | null
): number | null {
  if (!book || !centerPrice || centerPrice <= 0 || !book.bids.length || !book.asks.length)
    return null;
  const farBid = book.bids[book.bids.length - 1]?.price ?? centerPrice;
  const farAsk = book.asks[book.asks.length - 1]?.price ?? centerPrice;
  return Math.max(0, Math.min(centerPrice - farBid, farAsk - centerPrice));
}

/* Hook */

export function useHyperliquidOrderbook(
  symbol: string,
  enabled = true,
  options: UseHyperliquidOrderbookOptions = {}
) {
  const [fineBook, setFineBook] = useState<OrderbookData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isControlled = options.controlledNSigFigs !== undefined;
  const [uncontrolledSigFigs, setUncontrolledSigFigs] = useState(DEFAULT_N_SIG_FIGS);
  const activeSigFigs = isControlled
    ? Math.max(MIN_N_SIG_FIGS, Math.min(MAX_N_SIG_FIGS, options.controlledNSigFigs!))
    : uncontrolledSigFigs;

  // Mutable refs
  const activeSigFigsRef = useRef(activeSigFigs);
  useEffect(() => {
    activeSigFigsRef.current = activeSigFigs;
  }, [activeSigFigs]);

  const pending = useRef<OrderbookData | null>(null);
  const raf = useRef(0);
  const wsHasReceivedData = useRef(false);
  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const coinRef = useRef(coin);
  useEffect(() => {
    coinRef.current = coin;
  }, [coin]);

  // RAF-throttled flush — always sets state, RAF caps at 60fps
  const schedule = useCallback((data: OrderbookData) => {
    pending.current = data;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      if (pending.current) setFineBook(pending.current);
      raf.current = 0;
    });
  }, []);

  //  REST SEED — oneshot snapshot, discarded once WS starts streaming

  const { data: restSnapshot } = useQuery({
    queryKey: queryKeys.orderbook.snapshot(symbol),
    queryFn: () => api.getOrderbook(symbol, activeSigFigsRef.current),
    enabled: enabled && !!symbol,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!restSnapshot || wsHasReceivedData.current) return;
    const raw = restSnapshot as {
      orderbook?: { levels?: [L2BookLevel[], L2BookLevel[]] };
      levels?: [L2BookLevel[], L2BookLevel[]];
    };
    const levels = raw?.orderbook?.levels ?? raw?.levels;
    if (levels && Array.isArray(levels) && levels.length === 2) {
      schedule(
        processRawL2Levels(
          (levels[0] ?? []).slice(0, MAX_DEPTH),
          (levels[1] ?? []).slice(0, MAX_DEPTH)
        )
      );
    }
  }, [restSnapshot, schedule]);

  //  WS STREAMING

  const subscription = useMemo(
    () => (enabled && coin ? { type: "l2Book" as const, coin, nSigFigs: activeSigFigs } : null),
    [enabled, coin, activeSigFigs]
  );

  const handleMessage = useCallback(
    (data: unknown, ch: string, meta?: { nSigFigs?: number; interval?: string; coin?: string }) => {
      if (ch !== "l2Book") return;
      if (meta?.nSigFigs !== undefined && meta.nSigFigs !== activeSigFigsRef.current) return;
      if (meta?.coin !== undefined && meta.coin !== coinRef.current) return;
      const book = data as { levels: [L2BookLevel[], L2BookLevel[]] };
      if (!book?.levels) return;

      wsHasReceivedData.current = true;
      const bids = book.levels[0]?.slice(0, MAX_DEPTH) ?? [];
      const asks = book.levels[1]?.slice(0, MAX_DEPTH) ?? [];
      schedule(processRawL2Levels(bids, asks));
    },
    [schedule]
  );

  const fetchRestSnapshot = useCallback(async () => {
    try {
      const c = coinRef.current;
      if (!c) return;
      const raw = await api.getOrderbook(c, activeSigFigsRef.current);
      const book = raw as {
        orderbook?: { levels?: [L2BookLevel[], L2BookLevel[]] };
        levels?: [L2BookLevel[], L2BookLevel[]];
      };
      const levels = book?.orderbook?.levels ?? book?.levels;
      if (levels && Array.isArray(levels) && levels.length === 2) {
        schedule(
          processRawL2Levels(
            (levels[0] ?? []).slice(0, MAX_DEPTH),
            (levels[1] ?? []).slice(0, MAX_DEPTH)
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch REST snapshot");
    }
  }, [schedule]);

  const ws = useHyperliquidWs({
    subscription,
    onMessage: handleMessage,
    enabled: enabled && !!symbol,
    onError: (e) => setError(e.message),
    onReconnect: fetchRestSnapshot,
  });

  // Resubscribe (precision change)
  const resubscribe = useCallback(
    (nSigFigs: number) => {
      const next = Math.max(MIN_N_SIG_FIGS, Math.min(MAX_N_SIG_FIGS, nSigFigs));
      if (!coin || !ws.resubscribe || next === activeSigFigsRef.current) return;
      ws.resubscribe({ type: "l2Book", coin, nSigFigs: next });
      if (!isControlled) setUncontrolledSigFigs(next);
    },
    [coin, ws, isControlled]
  );

  //  ADAPTIVE SIGFIGS (cooldown-gated, fully guarded)

  const lastResubscribeAtRef = useRef(0);
  const adaptiveDirectionRef = useRef<"out" | "in" | null>(null);
  const adaptiveDirectionCountRef = useRef(0);

  useEffect(() => {
    if (!options.adaptiveNSigFigs) return;
    if (isControlled || !enabled || !fineBook) return;

    const now = Date.now();
    if (now - lastResubscribeAtRef.current < RESUBSCRIBE_COOLDOWN_MS) return;

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
    if (adaptiveDirectionCountRef.current < 2) return;

    adaptiveDirectionRef.current = null;
    if (direction === "out" && activeSigFigs > MIN_N_SIG_FIGS) {
      queueMicrotask(() => resubscribe(activeSigFigs - 1));
      return;
    }
    if (direction === "in" && activeSigFigs < MAX_N_SIG_FIGS) {
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

  return {
    orderbook: fineBook,
    isConnected: ws.isConnected,
    error,
    resubscribe,
    activeSigFigs,
  };
}
