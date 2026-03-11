import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import { getQueryOptions } from "@/lib/query/client";

interface UseChartDataOptions {
  readonly symbol: string;
  readonly interval: string;
  readonly timeframe: string;
  readonly enabled?: boolean;
}

// Lấy dữ liệu chart
export function useChartData({ symbol, interval, timeframe, enabled = true }: UseChartDataOptions) {
  return useQuery({
    queryKey: queryKeys.chart.byParams(symbol, interval, timeframe),
    queryFn: () => api.getChartData(symbol, interval, timeframe),
    enabled: !!symbol && enabled,
    ...getQueryOptions.chart,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// Lấy dữ liệu chart với auto-refetch mỗi 60s
export function useRealtimeChartData({
  symbol,
  interval,
  timeframe,
  enabled = true,
}: UseChartDataOptions) {
  return useQuery({
    queryKey: queryKeys.chart.byParams(symbol, interval, timeframe),
    queryFn: () => api.getChartData(symbol, interval, timeframe),
    enabled: !!symbol && enabled,
    ...getQueryOptions.chart,
    refetchInterval: 60 * 1000,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
