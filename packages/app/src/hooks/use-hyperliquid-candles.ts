import { useEffect, useRef, useState, useCallback } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";

const WS_URL = "wss://api.hyperliquid.xyz/ws";
const API_INFO_URL = "https://api.hyperliquid.xyz/info";

// Supported intervals for Hyperliquid
const SUPPORTED_INTERVALS = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
] as const;

type Interval = (typeof SUPPORTED_INTERVALS)[number];

interface HyperliquidCandle {
  t: number; // timestamp in ms
  o: string; // open
  h: string; // high
  l: string; // low
  c: string; // close
  v: string; // volume
}

interface WsMessage {
  channel: string;
  data: HyperliquidCandle | HyperliquidCandle[];
}

interface UseHyperliquidCandlesOptions {
  symbol: string;
  interval: string;
  limit?: number;
  enabled?: boolean;
}

interface UseHyperliquidCandlesReturn {
  data: ChartDataPoint[];
  isLoading: boolean;
  isConnected: boolean;
  error: Error | null;
  loadMore: (count?: number) => Promise<void>;
  hasMore: boolean;
}

// Map interval from UI format to Hyperliquid format
const mapInterval = (interval: string): Interval => {
  const mapping: Record<string, Interval> = {
    "1m": "1m",
    "3m": "3m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "8h": "8h",
    "12h": "12h",
    "1d": "1d",
    "3d": "3d",
    "1w": "1w",
    "1M": "1M",
  };
  return mapping[interval] || "1h";
};

// Normalize symbol for Hyperliquid (remove USDT suffix)
const normalizeSymbol = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  return upper.endsWith("USDT") ? upper.slice(0, -4) : upper;
};

// Convert Hyperliquid candle to ChartDataPoint
const convertCandle = (candle: HyperliquidCandle): ChartDataPoint => ({
  time: Math.floor(candle.t / 1000),
  open: parseFloat(candle.o),
  high: parseFloat(candle.h),
  low: parseFloat(candle.l),
  close: parseFloat(candle.c),
  volume: parseFloat(candle.v),
});

// Fetch historical candle data via REST API - gets most recent N candles
const fetchHistoricalData = async (
  symbol: string,
  interval: Interval,
  limit: number
): Promise<ChartDataPoint[]> => {
  const coin = normalizeSymbol(symbol);
  const now = Date.now();
  const intervalMs = getIntervalMilliseconds(interval);
  const startTime = now - limit * intervalMs;

  const response = await fetch(API_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: { coin, interval, startTime, endTime: now },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch historical data: ${response.statusText}`);
  }

  const candles: HyperliquidCandle[] = await response.json();

  return candles
    .sort((a, b) => a.t - b.t)
    .slice(-limit)
    .map(convertCandle);
};

// Fetch older historical data by time range (for infinite scroll)
const fetchOlderData = async (
  symbol: string,
  interval: Interval,
  endTime: number,
  count: number
): Promise<ChartDataPoint[]> => {
  const coin = normalizeSymbol(symbol);
  const intervalMs = getIntervalMilliseconds(interval);
  const startTime = endTime - count * intervalMs;

  const response = await fetch(API_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: { coin, interval, startTime, endTime },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch older data: ${response.statusText}`);
  }

  const candles: HyperliquidCandle[] = await response.json();

  return candles.sort((a, b) => a.t - b.t).map(convertCandle);
};

const getIntervalMilliseconds = (interval: string): number => {
  const value = parseInt(interval);
  const unit = interval.slice(-1);
  const multipliers: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    M: 30 * 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit] || 60 * 60 * 1000);
};

export function useHyperliquidCandles({
  symbol,
  interval,
  limit = 200,
  enabled = true,
}: UseHyperliquidCandlesOptions): UseHyperliquidCandlesReturn {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Use refs to survive React Strict Mode's double mount/unmount
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<ChartDataPoint[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const dataRef = useRef<ChartDataPoint[]>([]);
  const limitRef = useRef(limit);
  limitRef.current = limit;
  const isFetchingRef = useRef(false);
  const disconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionRef = useRef<{ symbol: string; interval: Interval } | null>(null);

  // Throttled update using requestAnimationFrame
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) return;

    const now = performance.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    const minInterval = 16; // 60fps

    const executeUpdate = () => {
      if (bufferRef.current.length > 0) {
        const newCandles = bufferRef.current;
        bufferRef.current = [];

        // Use Map for O(1) lookups instead of O(n) findIndex
        const candleMap = new Map<number, ChartDataPoint>();
        for (const candle of dataRef.current) {
          candleMap.set(candle.time, candle);
        }

        // Update with new candles
        for (const candle of newCandles) {
          candleMap.set(candle.time, candle);
        }

        // Convert back to array, sort, and limit
        const sorted = Array.from(candleMap.values())
          .sort((a, b) => a.time - b.time)
          .slice(-limit);

        dataRef.current = sorted;
        setData(sorted);
        lastUpdateRef.current = performance.now();
      }
      rafRef.current = null;
    };

    if (timeSinceLastUpdate >= minInterval) {
      executeUpdate();
    } else {
      rafRef.current = requestAnimationFrame(() => {
        setTimeout(executeUpdate, minInterval - timeSinceLastUpdate);
      });
    }
  }, [limit]);

  useEffect(() => {
    if (!enabled || !symbol) {
      setIsLoading(false);
      return;
    }

    // Fix for React Strict Mode: clear any pending disconnect
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }

    const coin = normalizeSymbol(symbol);
    const hlInterval = mapInterval(interval);

    // Check if we need to reconnect (different interval)
    const currentSubscription = subscriptionRef.current;
    const needsReconnect = !currentSubscription || currentSubscription.interval !== hlInterval;

    // Close existing WebSocket if interval changed - synchronous close
    if (needsReconnect && wsRef.current) {
      try {
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close(1000, "Interval changed");
        }
      } catch {
        // Ignore close errors
      }
      wsRef.current = null;
      subscriptionRef.current = null;
      dataRef.current = [];
      setData([]);
    }

    // Skip if already connected to correct interval
    if (!needsReconnect && wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    fetchHistoricalData(symbol, hlInterval, limit)
      .then((historicalData) => {
        dataRef.current = historicalData;
        setData(historicalData);
        setIsLoading(false);
        isFetchingRef.current = false;

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          subscriptionRef.current = { symbol: coin, interval: hlInterval };
          ws.send(
            JSON.stringify({
              method: "subscribe",
              subscription: { type: "candle", coin, interval: hlInterval },
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as WsMessage;

            if (msg.channel === "candle") {
              const rawCandles = Array.isArray(msg.data) ? msg.data : [msg.data];
              const newCandles = rawCandles.map(convertCandle);

              if (newCandles.length > 0) {
                bufferRef.current.push(...newCandles);
                scheduleUpdate();
              }
            }
          } catch (err) {
            console.error("WS Parse error", err);
          }
        };

        ws.onerror = () => {
          setError(new Error("WebSocket connection error"));
        };

        ws.onclose = () => {
          setIsConnected(false);
        };
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        isFetchingRef.current = false;
      });

    return () => {
      // React Strict Mode fix: delay disconnect to allow remount to cancel it
      disconnectTimeoutRef.current = setTimeout(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (
          wsRef.current?.readyState === WebSocket.OPEN ||
          wsRef.current?.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }, 0);
    };
  }, [symbol, interval, enabled, scheduleUpdate]);

  // Load more historical data (for infinite scroll)
  const loadMore = useCallback(
    async (count: number = 200) => {
      if (!hasMore || data.length === 0) return;

      const oldestTime = data[0].time * 1000; // Convert to ms
      const hlInterval = mapInterval(interval);

      try {
        const olderData = await fetchOlderData(symbol, hlInterval, oldestTime, count);

        if (olderData.length === 0) {
          setHasMore(false);
          return;
        }

        const merged = [...olderData, ...data];
        dataRef.current = merged;
        setData(merged);

        // Check if we hit the limit (no more data available)
        if (olderData.length < count) {
          setHasMore(false);
        }
      } catch (err) {
        console.error("Failed to load more data:", err);
      }
    },
    [symbol, interval, data, hasMore]
  );

  return { data, isLoading, isConnected, error, loadMore, hasMore };
}
