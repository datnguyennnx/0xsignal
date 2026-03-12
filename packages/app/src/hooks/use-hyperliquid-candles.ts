import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { useHyperliquidWs, normalizeSymbol, API_INFO_URL } from "./use-hyperliquid-ws";

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

const mapInterval = (interval: string): Interval =>
  (["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "3d", "1w", "1M"].includes(
    interval
  )
    ? interval
    : "1h") as Interval;

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

// WS candle (numeric OHLCV per Hyperliquid docs)
interface WsCandle {
  t: number;
  T: number;
  s: string;
  i: string;
  o: number;
  c: number;
  h: number;
  l: number;
  v: number;
  n: number;
}

// REST candle (string OHLCV)
interface RestCandle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

const fromRest = (c: RestCandle): ChartDataPoint => ({
  time: Math.floor(c.t / 1000),
  open: parseFloat(c.o),
  high: parseFloat(c.h),
  low: parseFloat(c.l),
  close: parseFloat(c.c),
  volume: parseFloat(c.v),
});

const fromWs = (c: WsCandle): ChartDataPoint => ({
  time: Math.floor(c.t / 1000),
  open: Number(c.o),
  high: Number(c.h),
  low: Number(c.l),
  close: Number(c.c),
  volume: Number(c.v),
});

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

  const dataRef = useRef<ChartDataPoint[]>([]);
  const bufferRef = useRef<ChartDataPoint[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastLoadMoreTimeRef = useRef<number>(0);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const intervalRef = useRef(interval);
  intervalRef.current = interval;

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const hlInterval = useMemo(() => mapInterval(interval), [interval]);

  const subscription = useMemo(
    () => (enabled && coin ? { type: "candle" as const, coin, interval: hlInterval } : null),
    [enabled, coin, hlInterval]
  );

  // RAF-throttled buffer flush
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

  useHyperliquidWs({
    subscription,
    onMessage: handleMessage,
    enabled: enabled && !!symbol,
    onConnectionChange: handleConnectionChange,
    onError: handleError,
  });

  // Initial fetch on symbol/interval change
  useEffect(() => {
    if (!enabled || !symbol) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    dataRef.current = [];
    setData([]);
    setHasMore(true);

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

  // Stable loadMore — reads mutable state from refs
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
