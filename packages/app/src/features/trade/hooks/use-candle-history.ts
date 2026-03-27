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
import { mapToHLInterval, getIntervalMs, type HLInterval } from "@/core/utils/hyperliquid";

// REST API candle format (string OHLCV)
export interface RestCandle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

// Convert REST response to ChartDataPoint
export const fromRest = (c: RestCandle): ChartDataPoint => ({
  time: Math.floor(c.t / 1000),
  open: parseFloat(c.o),
  high: parseFloat(c.h),
  low: parseFloat(c.l),
  close: parseFloat(c.c),
  volume: parseFloat(c.v),
});

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
  return candles
    .sort((a, b) => a.t - b.t)
    .slice(-limit)
    .map((c: unknown) => fromRest(c as RestCandle));
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
  return candles.sort((a, b) => a.t - b.t).map((c: unknown) => fromRest(c as RestCandle));
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
