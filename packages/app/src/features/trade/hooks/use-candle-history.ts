import { useQuery } from "@tanstack/react-query";
import type { ChartDataPoint } from "@0xsignal/shared";
import { api } from "@/services/api";
import { getCandleSnapshot } from "@/services/hl-rest-client";
import { queryKeys } from "@/lib/query-keys";
import { normalizeSymbol } from "../lib/symbol";
import { resolveHlCoin } from "../lib/hl-market-stream";
import { getIntervalMs, mapToHLInterval, type HLInterval } from "@/core/utils/hyperliquid";

export async function fetchHistorical(symbol: string, interval: HLInterval, limit: number) {
  // Let the failure reject so the chart can tell an upstream outage apart from a
  // genuinely empty window, which resolves to `[]`.
  const backend = () => api.getRecentChartLane({ symbol, interval, limit });
  const coin = await resolveHlCoin(symbol);
  if (coin === null) return (await backend()).slice(-limit);

  const endTime = Date.now();
  const candles = await getCandleSnapshot(
    { coin, interval, startTime: endTime - limit * getIntervalMs(interval), endTime },
    backend,
  );
  return candles.slice(-limit);
}

export function fetchByRange(
  symbol: string,
  interval: HLInterval,
  startTime: number,
  endTime: number,
): Promise<ChartDataPoint[]> {
  const backend = () => api.getCandles({ symbol, interval, startTime, endTime });
  return resolveHlCoin(symbol).then((coin) =>
    coin === null ? backend() : getCandleSnapshot({ coin, interval, startTime, endTime }, backend),
  );
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
    enabled: enabled && symbol !== "",
    placeholderData: (previousData, previousQuery) => {
      if (previousData === undefined || previousQuery === undefined) return previousData;
      const prevKey = previousQuery.queryKey;
      return prevKey[2] === normalizedSymbol && prevKey[3] === hlInterval
        ? previousData
        : undefined;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (historical data is relatively static)
    gcTime: 15 * 60 * 1000,
  });
}
