import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHyperliquidWs } from "./use-hyperliquid-ws";
import { normalizeSymbol } from "../lib/symbol";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import type { OrderBook } from "@0xsignal/shared";
import { type L2BookLevel } from "@/core/utils/hyperliquid";
import {
  useMarketDataStore,
  useOrderbookData,
  useOrderbookReplaceRequested,
} from "@/stores/use-market-data-store";

export interface TickSizeOption {
  value: number | 0;
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
    opts.push({ value: sig, label, nSigFigs: sig, mantissa: null });
  }
  // "Raw" option — no aggregation, full precision
  opts.push({ value: 0, label: "Raw", nSigFigs: null, mantissa: null });
  return opts;
}

const DEFAULT_N_SIG_FIGS = 5;

interface UseHyperliquidOrderbookOptions {
  controlledNSigFigs?: number | null;
}

/** Normalize REST snapshot levels to L2BookLevel[] format. */
function unwrapRestSnapshotLevels(levels: unknown): [L2BookLevel[], L2BookLevel[]] | null {
  if (!Array.isArray(levels) || levels.length !== 2) return null;
  const bids = (levels[0] ?? []) as L2BookLevel[];
  const asks = (levels[1] ?? []) as L2BookLevel[];
  return [bids, asks];
}

export function useHyperliquidOrderbook(
  symbol: string,
  enabled = true,
  options: UseHyperliquidOrderbookOptions = {},
) {
  const [error, setError] = useState<string | null>(null);

  const controlledNSigFigs = options.controlledNSigFigs;
  const isControlled = controlledNSigFigs !== undefined;
  const [uncontrolledSigFigs, setUncontrolledSigFigs] = useState<2 | 3 | 4 | 5>(DEFAULT_N_SIG_FIGS);
  const activeSigFigs: number | null = isControlled
    ? (controlledNSigFigs ?? null)
    : uncontrolledSigFigs;

  const activeSigFigsRef = useRef(activeSigFigs);
  useEffect(() => {
    activeSigFigsRef.current = activeSigFigs;
  }, [activeSigFigs]);

  const wsHasReceivedData = useRef(false);
  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const coinRef = useRef(coin);
  useEffect(() => {
    coinRef.current = coin;
  }, [coin]);

  // Reset WS received flag when coin changes — allows REST seed for new coin
  useEffect(() => {
    wsHasReceivedData.current = false;
  }, [coin]);

  // ── Read from store ───────────────────────────────────────────────
  const orderbook = useOrderbookData(coin);
  const replaceRequestedAt = useOrderbookReplaceRequested(coin);
  const applySnapshot = useMarketDataStore((s) => s.applyOrderbookSnapshot);

  // ── REST SEED — oneshot snapshot, discarded once WS starts streaming ─

  const { data: restSnapshot } = useQuery({
    queryKey: queryKeys.market.orderbook.snapshot(symbol),
    queryFn: () => api.getOrderbook(symbol, 20) as Promise<OrderBook>,
    enabled: enabled && !!symbol,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!restSnapshot || wsHasReceivedData.current) return;
    const levels = unwrapRestSnapshotLevels(restSnapshot.orderbook?.levels);
    if (levels) {
      applySnapshot(coin, levels);
    }
  }, [restSnapshot, applySnapshot, coin]);

  // ── WS STREAMING ─────────────────────────────────────────────────

  // Re-subscribes when coin or nSigFigs changes — the useHyperliquidWs
  // hook auto-unsubscribes the old and creates a new subscription with
  // the updated nSigFigs, triggering server-side aggregation by Hyperliquid.
  const subscription = useMemo(
    () =>
      enabled && coin
        ? {
            channel: "l2Book" as const,
            symbol: coin,
            nSigFigs: (activeSigFigs as 2 | 3 | 4 | 5 | null) ?? undefined,
          }
        : null,
    [enabled, coin, activeSigFigs],
  );

  const fetchRestSnapshot = useCallback(async () => {
    try {
      const c = coinRef.current;
      if (!c) return;
      const rawData = await api.getOrderbook(c, 20);
      const levels = unwrapRestSnapshotLevels(rawData.orderbook?.levels);
      if (levels) {
        applySnapshot(c, levels);
      }
    } catch {
      // Silent — WS will send snapshot on reconnect
    }
  }, [applySnapshot]);

  const ws = useHyperliquidWs({
    subscription,
    enabled: enabled && !!symbol,
    onError: (e) => setError(e.message),
    onReconnect: fetchRestSnapshot,
  });

  // Mark WS data received when orderbook updates from store
  useEffect(() => {
    if (orderbook && restSnapshot) {
      wsHasReceivedData.current = true;
    }
  }, [orderbook, restSnapshot]);

  // ── WS SNAPSHOT REPLACEMENT (when replace: true from WS) ────────
  // When replace: true is received via store, resubscribe to WS for a fresh
  // snapshot instead of fetching REST. REST is only for the initial seed.
  // Rate-limited to prevent WS subscription churn.

  const replaceLastHandledRef = useRef(0);
  const REPLACE_COOLDOWN_MS = 3000;

  useEffect(() => {
    if (!replaceRequestedAt || !enabled) return;
    const now = Date.now();
    if (now - replaceLastHandledRef.current < REPLACE_COOLDOWN_MS) return;
    replaceLastHandledRef.current = now;

    if (ws.isConnected) {
      ws.resubscribe({
        channel: "l2Book",
        symbol: coin,
        nSigFigs: (activeSigFigsRef.current as 2 | 3 | 4 | 5 | null) ?? undefined,
      });
    } else {
      // Fallback to REST only if WS is disconnected
      queueMicrotask(async () => {
        try {
          const c = coinRef.current;
          if (!c) return;
          const rawData = await api.getOrderbook(c, 20);
          const levels = unwrapRestSnapshotLevels(rawData.orderbook?.levels);
          if (levels) {
            applySnapshot(c, levels);
          }
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to fetch REST snapshot");
        }
      });
    }
  }, [replaceRequestedAt, enabled, ws, coin, applySnapshot]);

  const resubscribe = useCallback(
    (nSigFigs: number) => {
      if (!coin || !ws.resubscribe) return;

      if (coinRef.current) {
        wsHasReceivedData.current = false;
      }

      ws.resubscribe({
        channel: "l2Book",
        symbol: coin,
        nSigFigs: (activeSigFigsRef.current as 2 | 3 | 4 | 5 | null) ?? undefined,
      });
      if (!isControlled) setUncontrolledSigFigs(nSigFigs as 2 | 3 | 4 | 5);
    },
    [coin, ws, isControlled],
  );

  return {
    orderbook,
    isConnected: ws.isConnected,
    error,
    resubscribe,
    activeSigFigs,
  };
}
