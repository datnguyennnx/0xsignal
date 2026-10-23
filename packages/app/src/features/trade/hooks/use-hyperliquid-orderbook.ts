import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHyperliquidWs } from "./use-hyperliquid-ws";
import { normalizeSymbol } from "../lib/symbol";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import { type L2BookLevel } from "@/core/utils/hyperliquid";
import {
  useMarketDataStore,
  useOrderbookData,
  useOrderbookReplaceRequested,
} from "@/stores/use-market-data-store";

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
const isL2LevelArray = (value: unknown): value is L2BookLevel[] => Array.isArray(value);

function unwrapRestSnapshotLevels(levels: unknown): [L2BookLevel[], L2BookLevel[]] | null {
  if (!Array.isArray(levels) || levels.length !== 2) return null;
  const bids: unknown = levels[0];
  const asks: unknown = levels[1];
  if (!isL2LevelArray(bids) || !isL2LevelArray(asks)) return null;
  return [bids, asks];
}

const isSigFigs = (value: number | null): value is 2 | 3 | 4 | 5 | null =>
  value === null || value === 2 || value === 3 || value === 4 || value === 5;

const toSubscriptionSigFigs = (value: number | null): 2 | 3 | 4 | 5 | undefined =>
  isSigFigs(value) && value !== null ? value : undefined;

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

  // Keep the ref in sync and reset the WS received flag when coin changes,
  // so the new coin gets its REST seed.
  useEffect(() => {
    coinRef.current = coin;
    wsHasReceivedData.current = false;
  }, [coin]);

  // ── Read from store ───────────────────────────────────────────────
  const orderbook = useOrderbookData(coin);
  const replaceRequestedAt = useOrderbookReplaceRequested(coin);
  const applySnapshot = useMarketDataStore((s) => s.applyOrderbookSnapshot);

  // ── REST SEED — oneshot snapshot, discarded once WS starts streaming ─

  const { data: restSnapshot } = useQuery({
    queryKey: queryKeys.market.orderbook.snapshot(symbol),
    queryFn: () => api.getOrderbook(symbol, 20),
    enabled: enabled && symbol !== "",
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
      enabled && coin !== ""
        ? {
            channel: "l2Book" as const,
            symbol: coin,
            nSigFigs: toSubscriptionSigFigs(activeSigFigs),
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
    enabled: enabled && symbol !== "",
    onError: (e) => {
      setError(e.message);
    },
    onReconnect: () => {
      void fetchRestSnapshot();
    },
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
    if (replaceRequestedAt === null || replaceRequestedAt === undefined || replaceRequestedAt === 0)
      return;
    if (!enabled) return;
    const now = Date.now();
    if (now - replaceLastHandledRef.current < REPLACE_COOLDOWN_MS) return;
    replaceLastHandledRef.current = now;

    const fetchFallbackSnapshot = async () => {
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
    };

    if (ws.isConnected) {
      void ws.resubscribe({
        channel: "l2Book",
        symbol: coin,
        nSigFigs: toSubscriptionSigFigs(activeSigFigsRef.current),
      });
    } else {
      // Fallback to REST only if WS is disconnected
      queueMicrotask(() => {
        void fetchFallbackSnapshot();
      });
    }
  }, [replaceRequestedAt, enabled, ws, coin, applySnapshot]);

  const resubscribe = useCallback(
    (nSigFigs: number) => {
      if (coin === "") return;

      if (coinRef.current) {
        wsHasReceivedData.current = false;
      }

      void ws.resubscribe({
        channel: "l2Book",
        symbol: coin,
        nSigFigs: toSubscriptionSigFigs(activeSigFigsRef.current),
      });
      if (!isControlled && isSigFigs(nSigFigs) && nSigFigs !== null) {
        setUncontrolledSigFigs(nSigFigs);
      }
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
