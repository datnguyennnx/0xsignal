/**
 * @overview Candle History Fetching Hook
 *
 * It uses TanStack Query to fetch historical OHLCV data from the Hyperliquid REST API.
 * This ensures proper caching, deduplication, and retry logic.
 */
import { useQuery } from "@tanstack/react-query";
import type { ChartDataPoint } from "@0xsignal/shared";
import { hyperliquidApi } from "@/services/hyperliquid";
import { normalizeSymbol } from "./use-hyperliquid-ws";
import {
  mapToHLInterval,
  getIntervalMs,
  toFiniteNumber,
  type HLInterval,
} from "@/core/utils/hyperliquid";

// REST API candle format (string OHLCV)
export interface RestCandle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

function toRestCandle(value: unknown): RestCandle | null {
  if (typeof value !== "object" || value === null) return null;
  const candle = value as Record<string, unknown>;

  const t = toFiniteNumber(candle.t);
  if (t === null) return null;

  const o = typeof candle.o === "string" ? candle.o : null;
  const h = typeof candle.h === "string" ? candle.h : null;
  const l = typeof candle.l === "string" ? candle.l : null;
  const c = typeof candle.c === "string" ? candle.c : null;
  const v = typeof candle.v === "string" ? candle.v : null;

  if (!o || !h || !l || !c || !v) return null;

  return {
    t,
    o,
    h,
    l,
    c,
    v,
  };
}

// Convert REST response to ChartDataPoint
export const fromRest = (c: RestCandle): ChartDataPoint | null => {
  const open = toFiniteNumber(c.o);
  const high = toFiniteNumber(c.h);
  const low = toFiniteNumber(c.l);
  const close = toFiniteNumber(c.c);
  const volume = toFiniteNumber(c.v);

  if (open === null || high === null || low === null || close === null || volume === null) {
    return null;
  }

  return {
    time: Math.floor(c.t / 1000),
    open,
    high,
    low,
    close,
    volume,
  };
};

function toChartData(raw: unknown): ChartDataPoint | null {
  const parsed = toRestCandle(raw);
  if (!parsed) return null;
  return fromRest(parsed);
}

/**
 * Fetches historical candles from Hyperliquid REST API
 */
async function fetchHistorical(symbol: string, interval: HLInterval, limit: number) {
  const coin = normalizeSymbol(symbol);
  const now = Date.now();
  const candles = await hyperliquidApi.candleSnapshot(
    coin,
    interval,
    now - limit * getIntervalMs(interval),
    now
  );
  const parsed = candles
    .map((c) => toRestCandle(c))
    .filter((c): c is RestCandle => c !== null)
    .sort((a, b) => a.t - b.t)
    .slice(-limit);

  return parsed.map(fromRest).filter((c): c is ChartDataPoint => c !== null);
}

/**
 * Fetches candles by time range (for loadMore)
 */
export async function fetchByRange(
  symbol: string,
  interval: HLInterval,
  startTime: number,
  endTime: number
) {
  const coin = normalizeSymbol(symbol);
  const candles = await hyperliquidApi.candleSnapshot(coin, interval, startTime, endTime);

  const parsed = candles
    .map((c) => toRestCandle(c))
    .filter((c): c is RestCandle => c !== null)
    .sort((a, b) => a.t - b.t);

  return parsed.map((c) => toChartData(c)).filter((c): c is ChartDataPoint => c !== null);
}

export function useCandleHistory(
  symbol: string,
  interval: string,
  limit: number = 200,
  enabled: boolean = true
) {
  const hlInterval = mapToHLInterval(interval);
  return useQuery({
    queryKey: ["candles", symbol, interval, limit],
    queryFn: () => fetchHistorical(symbol, hlInterval, limit),
    enabled: enabled && !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes (historical data is relatively static)
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
  });
}
