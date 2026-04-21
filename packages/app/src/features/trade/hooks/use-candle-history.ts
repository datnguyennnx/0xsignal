/**
 * @overview Candle History Fetching Hook
 *
 * It uses TanStack Query to fetch historical OHLCV data from backend candle APIs.
 * Frontend stays transport/render-local while backend owns canonical storage and coverage.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import { normalizeSymbol } from "../lib/symbol";
import { mapToHLInterval, type HLInterval } from "@/core/utils/hyperliquid";

async function fetchHistorical(symbol: string, interval: HLInterval, limit: number) {
  const candles = await api.getRecentChartLane({
    symbol,
    interval,
    limit,
  });
  return candles.slice(-limit);
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
  return api.getCandles({
    symbol,
    interval,
    startTime,
    endTime,
  });
}

export function useCandleHistory(
  symbol: string,
  interval: string,
  limit: number = 200,
  enabled: boolean = true
) {
  const hlInterval = mapToHLInterval(interval);
  const normalizedSymbol = normalizeSymbol(symbol);
  return useQuery({
    queryKey: queryKeys.chart.candles(normalizedSymbol, hlInterval, limit),
    queryFn: () => fetchHistorical(normalizedSymbol, hlInterval, limit),
    enabled: enabled && !!symbol,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 minutes (historical data is relatively static)
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
  });
}
