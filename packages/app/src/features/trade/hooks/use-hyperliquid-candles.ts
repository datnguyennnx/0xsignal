import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
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
const HAS_MORE_KEY_LIMIT = 8;

const isChartDataPointArray = (value: unknown): value is ChartDataPoint[] => Array.isArray(value);

/** One identity while history is pending; a fresh `[]` per render invalidates downstream memos. */
const EMPTY_CANDLES: ChartDataPoint[] = [];

export function useHyperliquidCandles({
  symbol,
  interval,
  limit = 200,
  enabled = true,
}: UseHyperliquidCandlesOptions) {
  const candleKey = `${normalizeSymbol(symbol)}:${interval}`;

  const [isConnected, setIsConnected] = useState(false);
  const [wsError, setWsError] = useState<Error | null>(null);
  const [hasMoreByKey, setHasMoreByKey] = useState<Record<string, boolean>>({});
  const [isFetching, setIsFetching] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const hasMore = hasMoreByKey[candleKey] ?? true;

  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastLoadMoreTimeRef = useRef<number>(0);
  const fetchIndicatorStartedAtRef = useRef<number>(0);
  const fetchIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const symbolRef = useRef(symbol);
  const intervalRef = useRef(interval);
  const historyIdentityRef = useRef<{ symbol: string; interval: string } | null>(null);
  const rangeAnchorRef = useRef<{
    symbol: string;
    interval: string;
    earliestMs: number;
  } | null>(null);

  useEffect(() => {
    symbolRef.current = symbol;
    intervalRef.current = interval;
  }, [symbol, interval]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const setHasMoreForKey = useCallback((key: string, value: boolean) => {
    setHasMoreByKey((prev) => {
      const next = { ...prev, [key]: value };
      // Bound the map to the keys viewed this session; drop the oldest first.
      const keys = Object.keys(next);
      if (keys.length > HAS_MORE_KEY_LIMIT) {
        for (const stale of keys.slice(0, keys.length - HAS_MORE_KEY_LIMIT)) {
          delete next[stale];
        }
      }
      return next;
    });
  }, []);

  // ── Read from store ───────────────────────────────────────────────
  const storedCandles = useCandleData(candleKey);
  const mergeHistoryCandles = useMarketDataStore((s) => s.mergeHistoryCandles);
  const appendCandles = useMarketDataStore((s) => s.appendCandles);

  // ── Historical data via React Query ───────────────────────────────

  const historical = useCandleHistory(symbol, interval, limit, enabled);
  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = historical;

  useEffect(() => {
    const previousIdentity = historyIdentityRef.current;
    const identityChanged =
      previousIdentity === null ||
      previousIdentity.symbol !== symbol ||
      previousIdentity.interval !== interval;

    historyIdentityRef.current = { symbol, interval };

    if (identityChanged) {
      // Frames may already have landed on this key. Merge rather than replace so a
      // history page that resolves late cannot wipe them (wholesale only when empty).
      if (historyData !== undefined) mergeHistoryCandles(candleKey, historyData);
      // The recent page spans the last `limit` bars ending now; backfill must stop there.
      rangeAnchorRef.current = {
        symbol,
        interval,
        earliestMs: Date.now() - limit * getIntervalMs(interval),
      };
      return;
    }

    if (historyData === undefined) return;

    // A backfill may have landed before the recent page resolved, and live frames may
    // already have updated the forming bar: merge without regressing either.
    mergeHistoryCandles(candleKey, historyData);

    if (historyData.length > 0) {
      const historyEarliestMs = historyData[0].time * 1000;
      const anchor = rangeAnchorRef.current;
      const anchorEarliestMs =
        anchor !== null && anchor.symbol === symbol && anchor.interval === interval
          ? anchor.earliestMs
          : historyEarliestMs;
      rangeAnchorRef.current = {
        symbol,
        interval,
        earliestMs: Math.min(anchorEarliestMs, historyEarliestMs),
      };
    }
  }, [historyData, symbol, interval, candleKey, limit, mergeHistoryCandles]);

  // ── WS subscription ───────────────────────────────────────────────

  const hlInterval = useMemo(() => mapToHLInterval(interval), [interval]);
  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const currentCoinRef = useRef(coin);

  useEffect(() => {
    currentCoinRef.current = coin;
  }, [coin]);

  const subscription = useMemo(
    () =>
      enabled && coin !== ""
        ? {
            channel: "candle" as const,
            symbol: coin,
            interval: hlInterval,
            // Part of the identity on purpose: bumping retryToken re-subscribes the stream.
            retryToken,
          }
        : null,
    [enabled, coin, hlInterval, retryToken],
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
      if (isChartDataPointArray(rawData) && rawData.length > 0) {
        appendCandles(candleKey, rawData);
      }
    },
    [hlInterval, candleKey, appendCandles],
  );

  const handleConnectionChange = useCallback((c: boolean) => {
    setIsConnected(c);
  }, []);
  const handleError = useCallback((e: Error) => {
    setWsError(e);
  }, []);

  const retry = useCallback(() => {
    setWsError(null);
    void refetchHistory();
    setRetryToken((token) => token + 1);
  }, [refetchHistory]);

  useHyperliquidWs({
    subscription,
    onMessage: handleMessage,
    enabled: enabled && symbol !== "",
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

      const targetSymbol = symbolRef.current;
      const targetInterval = intervalRef.current;
      const intervalMs = getIntervalMs(targetInterval);

      // The requested frontier is known before the recent page resolves: either the
      // tracked backfill boundary or the start of the pending `limit`-bar window.
      const anchor = rangeAnchorRef.current;
      const anchorEarliestMs =
        anchor !== null && anchor.symbol === targetSymbol && anchor.interval === targetInterval
          ? anchor.earliestMs
          : Date.now() - limit * intervalMs;
      const endTime = anchorEarliestMs - 1;
      const startTime = endTime - count * intervalMs;

      isFetchingRef.current = true;
      setFetchingWithMinimumDuration(true);
      lastLoadMoreTimeRef.current = Date.now();

      const hlInt = mapToHLInterval(targetInterval);

      try {
        const older = await fetchByRange(targetSymbol, hlInt, startTime, endTime);

        // Guard: ensure symbol/interval hasn't changed mid-fetch
        if (targetSymbol !== symbolRef.current || targetInterval !== intervalRef.current) {
          return;
        }

        if (older.length === 0) {
          setHasMoreForKey(candleKey, false);
          return;
        }

        // Move the frontier behind this request so the next window cannot overlap it.
        rangeAnchorRef.current = {
          symbol: targetSymbol,
          interval: targetInterval,
          earliestMs: startTime,
        };

        const existing = new Set((storedCandles ?? []).map((d) => d.time));
        const filtered = older.filter((d) => !existing.has(d.time));

        if (filtered.length === 0) {
          const earliestFetchedTime = older[0]?.time;
          if (earliestFetchedTime === undefined || earliestFetchedTime * 1000 >= anchorEarliestMs) {
            setHasMoreForKey(candleKey, false);
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
    [
      storedCandles,
      setFetchingWithMinimumDuration,
      setHasMoreForKey,
      candleKey,
      appendCandles,
      limit,
    ],
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
    data: storedCandles ?? EMPTY_CANDLES,
    isLoading: historyLoading,
    isConnected,
    error: wsError ?? historyError,
    loadMore,
    retry,
    hasMore,
    isFetching,
  };
}
