/**
 * @overview Hyperliquid Candlestick Hook
 *
 * It manages the lifecycle of candlestick data for a given symbol and interval.
 * It combines historical REST data with real-time WebSocket updates, providing
 * a unified, high-performance stream for chart rendering.
 *
 * @mechanism
 * 1. Initial Load: Fetch historical data via useCandleHistory (React Query)
 * 2. Streaming: Subscribe to real-time candles via useHyperliquidWs
 * 3. Throttling: Buffer rapid WebSocket updates and flush to state at 60fps using RAF
 * 4. Merging: Combine history + stream with O(1) deduplication by timestamp
 *
 * @performance
 * - Throttled updates prevent React re-render storms during high volatility
 * - Infinite scroll (loadMore) logic uses refs to avoid stale closures
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { useHyperliquidWs, normalizeSymbol } from "./use-hyperliquid-ws";
import { useCandleHistory, fetchByRange } from "./use-candle-history";
import { mapToHLInterval, getIntervalMs, toFiniteNumber } from "@/core/utils/hyperliquid";

interface UseHyperliquidCandlesOptions {
  symbol: string;
  interval: string;
  limit?: number;
  enabled?: boolean;
}

interface WsCandlePayload {
  t: number;
  T: number;
  s: string;
  i: string;
  o: unknown;
  c: unknown;
  h: unknown;
  l: unknown;
  v: unknown;
  V: unknown;
  n: number;
}

/**
 * Extracts candle payloads from various Hyperliquid WS message formats.
 */
function extractWsCandlePayloads(rawData: unknown): WsCandlePayload[] {
  if (typeof rawData !== "object" || rawData === null) return [];
  const data = rawData as { data?: unknown };
  if (Array.isArray(data)) return data as WsCandlePayload[];
  if (data.data && Array.isArray(data.data)) return data.data as WsCandlePayload[];
  if (data.data) return [data.data as WsCandlePayload];
  return [data as WsCandlePayload];
}

const LOAD_MORE_COOLDOWN = 1000;

export function useHyperliquidCandles({
  symbol,
  interval,
  limit = 200,
  enabled = true,
}: UseHyperliquidCandlesOptions) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Refs for mutable data (avoid re-renders)
  const dataRef = useRef<ChartDataPoint[]>([]);
  const bufferRef = useRef<ChartDataPoint[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(performance.now());
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastLoadMoreTimeRef = useRef<number>(0);
  const symbolRef = useRef(symbol);
  const intervalRef = useRef(interval);

  // Keep refs in sync
  symbolRef.current = symbol;
  intervalRef.current = interval;
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // Use the new decomposed history hook
  const historical = useCandleHistory(symbol, interval, limit, enabled);
  const { data: historyData, isLoading: historyLoading, error: historyError } = historical;

  // Sync history error
  useEffect(() => {
    if (historyError) setError(historyError as Error);
  }, [historyError]);

  // Sync historical data to state
  // We reset dataRef and state whenever historyData changes (e.g. symbol/interval change)
  useEffect(() => {
    if (historyData) {
      dataRef.current = historyData;
      setData(historyData);
    } else {
      dataRef.current = [];
      setData([]);
    }
    setHasMore(true);
  }, [historyData]);

  const hlInterval = useMemo(() => mapToHLInterval(interval), [interval]);
  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);

  const subscription = useMemo(
    () => (enabled && coin ? { type: "candle" as const, coin, interval: hlInterval } : null),
    [enabled, coin, hlInterval]
  );

  /**
   * RAF-throttled buffer flush
   * Batches high-frequency WS updates to max 60fps
   */
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) return;
    const now = performance.now();
    const elapsed = now - lastUpdateRef.current;

    const flush = () => {
      if (bufferRef.current.length > 0) {
        const map = new Map<number, ChartDataPoint>();
        for (const c of dataRef.current) map.set(c.time, c);
        for (const c of bufferRef.current) map.set(c.time, c);
        bufferRef.current = [];
        const sorted = Array.from(map.values()).sort((a, b) => a.time - b.time);
        dataRef.current = sorted;
        setData(sorted);
        lastUpdateRef.current = performance.now();
      }
      rafRef.current = null;
    };

    if (elapsed >= 16) flush();
    else rafRef.current = requestAnimationFrame(() => setTimeout(flush, 16 - elapsed));
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleMessage = useCallback(
    (rawData: unknown, channel: string) => {
      if (channel !== "candle") return;
      const payloads = extractWsCandlePayloads(rawData);
      const converted: ChartDataPoint[] = [];

      for (const p of payloads) {
        const open = toFiniteNumber(p.o);
        const high = toFiniteNumber(p.h);
        const low = toFiniteNumber(p.l);
        const close = toFiniteNumber(p.c);
        const volume = toFiniteNumber(p.v);

        if (open !== null && high !== null && low !== null && close !== null && volume !== null) {
          converted.push({
            time: Math.floor(p.t / 1000),
            open,
            high,
            low,
            close,
            volume,
          });
        }
      }

      if (converted.length > 0) {
        bufferRef.current.push(...converted);
        scheduleUpdate();
      }
    },
    [scheduleUpdate]
  );

  const handleConnectionChange = useCallback((c: boolean) => setIsConnected(c), []);
  const handleError = useCallback((e: Error) => setError(e), []);

  // WebSocket connection for real-time updates
  useHyperliquidWs({
    subscription,
    onMessage: handleMessage,
    enabled: enabled && !!symbol,
    onConnectionChange: handleConnectionChange,
    onError: handleError,
  });

  /**
   * Loads older candles for infinite scroll
   */
  const loadMore = useCallback(async (count: number = 200) => {
    if (isFetchingRef.current || !hasMoreRef.current) return;
    if (Date.now() - lastLoadMoreTimeRef.current < LOAD_MORE_COOLDOWN) return;

    const currentData = dataRef.current;
    if (currentData.length === 0) return;

    const targetSymbol = symbolRef.current;
    const targetInterval = intervalRef.current;

    isFetchingRef.current = true;
    setIsFetching(true);
    lastLoadMoreTimeRef.current = Date.now();

    const hlInt = mapToHLInterval(targetInterval);
    const endTime = currentData[0].time * 1000 - 1;
    const startTime = endTime - count * getIntervalMs(targetInterval);

    try {
      const older = await fetchByRange(targetSymbol, hlInt, startTime, endTime);

      // Verification: Ensure we haven't switched symbols/intervals while fetching
      if (targetSymbol !== symbolRef.current || targetInterval !== intervalRef.current) {
        return;
      }

      if (older.length === 0) {
        setHasMore(false);
        return;
      }

      const existing = new Set(dataRef.current.map((d) => d.time));
      const filtered = older.filter((d) => !existing.has(d.time));

      if (filtered.length === 0) {
        setHasMore(false);
        return;
      }

      const merged = [...filtered, ...dataRef.current];
      dataRef.current = merged;
      setData(merged);
      if (filtered.length < count * 0.5) setHasMore(false);
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally {
      isFetchingRef.current = false;
      setIsFetching(false);
    }
  }, []);

  return {
    data,
    dataRef,
    isLoading: historyLoading,
    isConnected,
    error,
    loadMore,
    hasMore,
    isFetching,
  };
}
