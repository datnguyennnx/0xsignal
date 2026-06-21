import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { normalizeChartDataPoints } from "@0xsignal/shared";
import { useHyperliquidWs } from "./use-hyperliquid-ws";
import { useCandleHistory, fetchByRange } from "./use-candle-history";
import { normalizeSymbol } from "../lib/symbol";
import { mapToHLInterval, getIntervalMs, type HLInterval } from "@/core/utils/hyperliquid";
import { useMarketDataStore, useCandleData } from "@/stores/use-market-data-store";

interface UseHyperliquidCandlesOptions {
  symbol: string;
  interval: HLInterval;
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
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

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

  // ── Read from store ───────────────────────────────────────────────
  const candleKey = `${normalizeSymbol(symbol)}:${interval}`;
  const storedCandles = useCandleData(candleKey);
  const setCandleData = useMarketDataStore((s) => s.setCandleData);
  const appendCandles = useMarketDataStore((s) => s.appendCandles);

  // ── Historical data via React Query ───────────────────────────────

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
      setCandleData(candleKey, normalized);
    } else {
      setCandleData(candleKey, []);
    }

    if (identityChanged) {
      setHasMore(true);
    }
  }, [historyData, symbol, interval, candleKey, setCandleData]);

  // ── WS subscription ───────────────────────────────────────────────

  const hlInterval = useMemo(() => mapToHLInterval(interval), [interval]);
  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const currentCoinRef = useRef(coin);
  currentCoinRef.current = coin;

  const subscription = useMemo(
    () =>
      enabled && coin ? { channel: "candle" as const, symbol: coin, interval: hlInterval } : null,
    [enabled, coin, hlInterval],
  );

  const handleMessage = useCallback(
    (
      rawData: unknown,
      channel: string,
      meta?: { nSigFigs?: number; interval?: string; coin?: string },
    ) => {
      if (channel !== "candle") return;
      if (meta?.interval !== undefined && meta.interval !== hlInterval) return;
      if (meta?.coin !== undefined && meta.coin !== currentCoinRef.current) return;

      // WS decoder returns ChartDataPoint[] shape
      const converted = rawData as ChartDataPoint[];
      if (converted.length > 0) {
        appendCandles(candleKey, converted);
      }
    },
    [hlInterval, candleKey, appendCandles],
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

  // ── Load more ──────────────────────────────────────────────────────

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

  const loadMore = useCallback(
    async (count: number = 200) => {
      if (isFetchingRef.current || !hasMoreRef.current) return;
      if (Date.now() - lastLoadMoreTimeRef.current < LOAD_MORE_COOLDOWN) return;

      const currentData = storedCandles ?? [];
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

        const existing = new Set(currentData.map((d) => d.time));
        const filtered = older.filter((d) => !existing.has(d.time));

        if (filtered.length === 0) {
          const earliestFetchedTime = older[0]?.time;
          const currentEarliestTime = currentData[0]?.time;
          if (
            earliestFetchedTime === undefined ||
            currentEarliestTime === undefined ||
            earliestFetchedTime >= currentEarliestTime
          ) {
            setHasMore(false);
          }
          return;
        }

        // Merge into store
        appendCandles(candleKey, filtered);
      } catch (err) {
        console.error("Failed to load more:", err);
      } finally {
        isFetchingRef.current = false;
        setFetchingWithMinimumDuration(false);
      }
    },
    [storedCandles, setFetchingWithMinimumDuration, candleKey, appendCandles],
  );

  // ── Cleanup ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (fetchIndicatorTimerRef.current) {
        clearTimeout(fetchIndicatorTimerRef.current);
        fetchIndicatorTimerRef.current = null;
      }
    };
  }, []);

  return {
    data: storedCandles ?? [],
    isLoading: historyLoading,
    isConnected,
    error,
    loadMore,
    hasMore,
    isFetching,
  };
}
