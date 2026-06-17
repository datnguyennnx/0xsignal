import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { normalizeChartDataPoints } from "@0xsignal/shared";
import { useHyperliquidWs } from "./use-hyperliquid-ws";
import { useCandleHistory, fetchByRange } from "./use-candle-history";
import { normalizeSymbol } from "../lib/symbol";
import { mapToHLInterval, getIntervalMs } from "@/core/utils/hyperliquid";

interface UseHyperliquidCandlesOptions {
  symbol: string;
  interval: string;
  limit?: number;
  enabled?: boolean;
}

const LOAD_MORE_COOLDOWN = 1000;
const LOAD_MORE_SPINNER_MIN_MS = 280;

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

  const dataRef = useRef<ChartDataPoint[]>([]);
  const bufferRef = useRef<ChartDataPoint[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(performance.now());
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastLoadMoreTimeRef = useRef<number>(0);
  const fetchIndicatorStartedAtRef = useRef<number>(0);
  const fetchIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const symbolRef = useRef(symbol);
  const intervalRef = useRef(interval);
  const historyIdentityRef = useRef<{ symbol: string; interval: string } | null>(null);

  symbolRef.current = symbol;
  intervalRef.current = interval;
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const historical = useCandleHistory(symbol, interval, limit, enabled);
  const { data: historyData, isLoading: historyLoading, error: historyError } = historical;

  useEffect(() => {
    if (historyError)
      setError(historyError instanceof Error ? historyError : new Error(String(historyError)));
  }, [historyError]);

  useEffect(() => {
    const previousIdentity = historyIdentityRef.current;
    const identityChanged =
      previousIdentity === null ||
      previousIdentity.symbol !== symbol ||
      previousIdentity.interval !== interval;

    historyIdentityRef.current = { symbol, interval };

    if (historyData) {
      const normalized = normalizeChartDataPoints(historyData);
      dataRef.current = normalized;
      setData(normalized);
    } else {
      dataRef.current = [];
      setData([]);
    }

    if (identityChanged) {
      setHasMore(true);
    }
  }, [historyData, symbol, interval]);

  const hlInterval = useMemo(() => mapToHLInterval(interval), [interval]);
  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const currentCoinRef = useRef(coin);
  currentCoinRef.current = coin;

  const subscription = useMemo(
    () => (enabled && coin ? { type: "candle" as const, coin, interval: hlInterval } : null),
    [enabled, coin, hlInterval],
  );

  // RAF-throttled buffer flush — O(n) merge of sorted arrays at max 60fps.
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const now = performance.now();
      if (now - lastUpdateRef.current < 16) return;

      const buffer = bufferRef.current;
      if (buffer.length === 0) return;
      bufferRef.current = [];

      const existing = dataRef.current;
      const result: ChartDataPoint[] = [];
      let i = 0; // index in existing
      let j = 0; // index in buffer

      // Both arrays are sorted by time ascending — O(n) merge
      while (i < existing.length && j < buffer.length) {
        if (existing[i].time < buffer[j].time) {
          result.push(existing[i]);
          i++;
        } else if (existing[i].time > buffer[j].time) {
          result.push(buffer[j]);
          j++;
        } else {
          // Same timestamp — buffer wins (most recent data)
          result.push(buffer[j]);
          i++;
          j++;
        }
      }
      // Append remaining (skip duplicates against last result entry)
      const lastTime = () => result[result.length - 1]?.time;
      while (i < existing.length && existing[i].time !== lastTime()) result.push(existing[i++]);
      while (j < buffer.length && buffer[j].time !== lastTime()) result.push(buffer[j++]);

      dataRef.current = result;
      setData(result);
      lastUpdateRef.current = now;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (fetchIndicatorTimerRef.current) {
        clearTimeout(fetchIndicatorTimerRef.current);
        fetchIndicatorTimerRef.current = null;
      }
    };
  }, []);

  const setFetchingWithMinimumDuration = useCallback((next: boolean) => {
    if (next) {
      if (fetchIndicatorTimerRef.current) {
        clearTimeout(fetchIndicatorTimerRef.current);
        fetchIndicatorTimerRef.current = null;
      }
      fetchIndicatorStartedAtRef.current = Date.now();
      setIsFetching(true);
      return;
    }

    const elapsed = Date.now() - fetchIndicatorStartedAtRef.current;
    const remaining = LOAD_MORE_SPINNER_MIN_MS - elapsed;
    if (remaining <= 0) {
      setIsFetching(false);
      return;
    }

    if (fetchIndicatorTimerRef.current) {
      clearTimeout(fetchIndicatorTimerRef.current);
    }
    fetchIndicatorTimerRef.current = setTimeout(() => {
      fetchIndicatorTimerRef.current = null;
      setIsFetching(false);
    }, remaining);
  }, []);

  const handleMessage = useCallback(
    (
      rawData: unknown,
      channel: string,
      meta?: { nSigFigs?: number; interval?: string; coin?: string },
    ) => {
      if (channel !== "candle") return;
      if (meta?.interval !== undefined && meta.interval !== hlInterval) return;
      // Symbol guard: reject candle data for a different coin
      if (meta?.coin !== undefined && meta.coin !== currentCoinRef.current) return;

      // safe: WS decoder returns ChartDataPoint[] shape
      const converted = rawData as ChartDataPoint[];
      if (converted.length > 0) {
        bufferRef.current.push(...converted);
        scheduleUpdate();
      }
    },
    [hlInterval, scheduleUpdate],
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

  const loadMore = useCallback(
    async (count: number = 200) => {
      if (isFetchingRef.current || !hasMoreRef.current) return;
      if (Date.now() - lastLoadMoreTimeRef.current < LOAD_MORE_COOLDOWN) return;

      const currentData = dataRef.current;
      if (currentData.length === 0) return;

      const targetSymbol = symbolRef.current;
      const targetInterval = intervalRef.current;

      isFetchingRef.current = true;
      setFetchingWithMinimumDuration(true);
      lastLoadMoreTimeRef.current = Date.now();

      const hlInt = mapToHLInterval(targetInterval);
      const endTime = currentData[0].time * 1000 - 1;
      const startTime = endTime - count * getIntervalMs(targetInterval);

      try {
        const older = await fetchByRange(targetSymbol, hlInt, startTime, endTime);

        // Guard: ensure symbol/interval hasn't changed mid-fetch
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
          const earliestFetchedTime = older[0]?.time;
          const currentEarliestTime = dataRef.current[0]?.time;
          if (
            earliestFetchedTime === undefined ||
            currentEarliestTime === undefined ||
            earliestFetchedTime >= currentEarliestTime
          ) {
            setHasMore(false);
          }
          return;
        }

        // Both filtered (older) and dataRef.current are sorted by time ascending — O(n) merge
        const merged: ChartDataPoint[] = [];
        let i = 0;
        let j = 0;
        while (i < filtered.length && j < dataRef.current.length) {
          if (filtered[i].time < dataRef.current[j].time) {
            merged.push(filtered[i++]);
          } else if (filtered[i].time > dataRef.current[j].time) {
            merged.push(dataRef.current[j++]);
          } else {
            // filtered wins (older data is authoritative; no conflict expected)
            merged.push(filtered[i++]);
            j++;
          }
        }
        // Append remaining (skip duplicates against last merged entry)
        const lastMerged = () => merged[merged.length - 1]?.time;
        while (i < filtered.length && filtered[i].time !== lastMerged()) merged.push(filtered[i++]);
        while (j < dataRef.current.length && dataRef.current[j].time !== lastMerged())
          merged.push(dataRef.current[j++]);

        dataRef.current = merged;
        setData(merged);
      } catch (err) {
        console.error("Failed to load more:", err);
      } finally {
        isFetchingRef.current = false;
        setFetchingWithMinimumDuration(false);
      }
    },
    [setFetchingWithMinimumDuration],
  );

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
