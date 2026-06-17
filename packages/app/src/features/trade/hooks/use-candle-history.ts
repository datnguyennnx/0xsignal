import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import { normalizeSymbol } from "../lib/symbol";
import { mapToHLInterval, type HLInterval } from "@/core/utils/hyperliquid";

async function fetchHistorical(symbol: string, interval: HLInterval, limit: number) {
  try {
    const candles = await api.getRecentChartLane({
      symbol,
      interval,
      limit,
    });
    return candles.slice(-limit);
  } catch (err) {
    console.error("Failed to fetch candle history:", err);
    return [];
  }
}

export async function fetchByRange(
  symbol: string,
  interval: HLInterval,
  startTime: number,
  endTime: number,
) {
  try {
    return await api.getCandles({
      symbol,
      interval,
      startTime,
      endTime,
    });
  } catch (err) {
    console.error("Failed to fetch candles by range:", err);
    return [];
  }
}

export function useCandleHistory(
  symbol: string,
  interval: HLInterval,
  limit: number = 200,
  enabled: boolean = true,
) {
  const hlInterval = mapToHLInterval(interval);
  const normalizedSymbol = normalizeSymbol(symbol);
  return useQuery({
    queryKey: queryKeys.market.candles(normalizedSymbol, hlInterval, limit),
    queryFn: () => fetchHistorical(normalizedSymbol, hlInterval, limit),
    enabled: enabled && !!symbol,
    placeholderData: (previousData, previousQuery) => {
      if (!previousData || !previousQuery) return undefined;
      const prevKey = previousQuery.queryKey as unknown as string[];
      if (prevKey[2] !== normalizedSymbol || prevKey[3] !== hlInterval) {
        return undefined;
      }
      return previousData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (historical data is relatively static)
    gcTime: 15 * 60 * 1000,
  });
}
