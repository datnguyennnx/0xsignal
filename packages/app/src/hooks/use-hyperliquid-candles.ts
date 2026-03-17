/**
 * @fileoverview Hyperliquid Candles Hook
 *
 * Fetches OHLCV candlestick data from Hyperliquid API with real-time WebSocket updates.
 *
 * @performance
 * - Uses RAF (Request Animation Frame) batching for high-frequency WS updates
 * - Deduplicates candles using Map by timestamp
 * - Memoizes subscriptions to prevent unnecessary re-connections
 * - Debounces loadMore to prevent rapid API calls
 *
 * @data-flow
 * 1. Initial: REST API fetch for historical candles
 * 2. Update: WebSocket for real-time ticks
 * 3. LoadMore: REST API for older candles
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { useHyperliquidWs, normalizeSymbol, API_INFO_URL } from "./use-hyperliquid-ws";

// Supported time intervals
type Interval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "12h"
  | "1d"
  | "3d"
  | "1w"
  | "1M";

// Maps user interval to Hyperliquid interval
const mapInterval = (interval: string): Interval =>
  (["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "3d", "1w", "1M"].includes(
    interval
  )
    ? interval
    : "1h") as Interval;

// Converts interval string to milliseconds
const getIntervalMs = (interval: string): number => {
  const value = parseInt(interval);
  const unit = interval.slice(-1);
  const mult: Record<string, number> = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    M: 2_592_000_000,
  };
  return value * (mult[unit] || 3_600_000);
};

// WebSocket candle format (numeric OHLCV)
interface WsCandle {
  t: number; // start time
  T: number; // end time
  s: string; // symbol
  i: string; // interval
  o: number; // open
  c: number; // close
  h: number; // high
  l: number; // low
  v: number; // volume
  n: number; // trades
}

// REST API candle format (string OHLCV)
interface RestCandle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

// Convert REST response to ChartDataPoint
const fromRest = (c: RestCandle): ChartDataPoint => ({
  time: Math.floor(c.t / 1000),
  open: parseFloat(c.o),
  high: parseFloat(c.h),
  low: parseFloat(c.l),
  close: parseFloat(c.c),
  volume: parseFloat(c.v),
});

// Convert WebSocket message to ChartDataPoint
const fromWs = (c: WsCandle): ChartDataPoint => ({
  time: Math.floor(c.t / 1000),
  open: Number(c.o),
  high: Number(c.h),
  low: Number(c.l),
  close: Number(c.c),
  volume: Number(c.v),
});

/**
 * Fetches historical candles from Hyperliquid REST API
 * @param symbol - Trading pair (e.g., "BTC", "ETH")
 * @param interval - Time interval
 * @param limit - Max candles to fetch
 */
async function fetchHistorical(symbol: string, interval: Interval, limit: number) {
  const coin = normalizeSymbol(symbol);
  const now = Date.now();
  const res = await fetch(API_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: { coin, interval, startTime: now - limit * getIntervalMs(interval), endTime: now },
    }),
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  const candles: RestCandle[] = await res.json();
  return candles
    .sort((a, b) => a.t - b.t)
    .slice(-limit)
    .map(fromRest);
}

/**
 * Fetches candles by time range (for loadMore)
 */
async function fetchByRange(
  symbol: string,
  interval: Interval,
  startTime: number,
  endTime: number
) {
  const coin = normalizeSymbol(symbol);
  const res = await fetch(API_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: { coin, interval, startTime, endTime },
    }),
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  const candles: RestCandle[] = await res.json();
  return candles.sort((a, b) => a.t - b.t).map(fromRest);
}

const LOAD_MORE_COOLDOWN = 1000;

interface UseHyperliquidCandlesOptions {
  symbol: string;
  interval: string;
  limit?: number;
  enabled?: boolean;
}

/**
 * Main hook for candlestick data
 * @returns {data, isLoading, isConnected, error, loadMore, hasMore}
 */
export function useHyperliquidCandles({
  symbol,
  interval,
  limit = 200,
  enabled = true,
}: UseHyperliquidCandlesOptions) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Refs for mutable data (avoid re-renders)
  const dataRef = useRef<ChartDataPoint[]>([]);
  const bufferRef = useRef<ChartDataPoint[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastLoadMoreTimeRef = useRef<number>(0);
  const symbolRef = useRef(symbol);
  const intervalRef = useRef(interval);
  const prevSymbolRef = useRef(symbol);

  symbolRef.current = symbol;
  intervalRef.current = interval;

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // Memoized values to prevent unnecessary effect triggers
  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const hlInterval = useMemo(() => mapInterval(interval), [interval]);

  const subscription = useMemo(
    () => (enabled && coin ? { type: "candle" as const, coin, interval: hlInterval } : null),
    [enabled, coin, hlInterval]
  );

  /**
   * RAF-throttled buffer flush
   * Batches high-frequency WS updates to max 60fps
   * Uses Map for O(1) deduplication by timestamp
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
    // Batch if >16ms since last update (60fps)
    if (elapsed >= 16) flush();
    else rafRef.current = requestAnimationFrame(() => setTimeout(flush, 16 - elapsed));
  }, []);

  const handleMessage = useCallback(
    (rawData: unknown, channel: string) => {
      if (channel !== "candle") return;
      const candles = Array.isArray(rawData) ? rawData : [rawData];
      const converted = candles.map((c: WsCandle) => fromWs(c));
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
   * Fetch on symbol/interval change
   * @strategy
   * - Symbol change: CLEAR data immediately (different coin = completely different prices)
   * - Interval change: Keep old data visible (same coin, just different timeframe)
   * @benefit
   * - Symbol change: Prevents showing wrong prices from previous coin
   * - Interval change: Smooth UX - no skeleton flash
   */
  useEffect(() => {
    if (!enabled || !symbol) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    isFetchingRef.current = true;

    const symbolChanged = prevSymbolRef.current !== symbol;
    prevSymbolRef.current = symbol;

    // CRITICAL: Clear data when symbol changes - different coin = different prices!
    if (symbolChanged) {
      dataRef.current = [];
      setData([]);
      setHasMore(true);
    }

    setIsLoading(true);
    setError(null);

    fetchHistorical(symbol, hlInterval, limit)
      .then((historical) => {
        if (cancelled) return;
        dataRef.current = historical;
        setData(historical);
        setIsLoading(false);
        isFetchingRef.current = false;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        isFetchingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, interval, enabled, hlInterval, limit]);

  /**
   * Loads older candles for infinite scroll
   * Uses refs to read current state without re-renders
   */
  const loadMore = useCallback(async (count: number = 200) => {
    if (isFetchingRef.current || !hasMoreRef.current) return;
    if (Date.now() - lastLoadMoreTimeRef.current < LOAD_MORE_COOLDOWN) return;

    const currentData = dataRef.current;
    if (currentData.length === 0) return;

    isFetchingRef.current = true;
    lastLoadMoreTimeRef.current = Date.now();

    const hlInt = mapInterval(intervalRef.current);
    const endTime = currentData[0].time * 1000 - 1;
    const startTime = endTime - count * getIntervalMs(intervalRef.current);

    try {
      const older = await fetchByRange(symbolRef.current, hlInt, startTime, endTime);
      if (older.length === 0) {
        setHasMore(false);
        isFetchingRef.current = false;
        return;
      }

      const existing = new Set(dataRef.current.map((d) => d.time));
      const filtered = older.filter((d) => !existing.has(d.time));
      if (filtered.length === 0) {
        setHasMore(false);
        isFetchingRef.current = false;
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
    }
  }, []);

  return { data, isLoading, isConnected, error, loadMore, hasMore };
}
