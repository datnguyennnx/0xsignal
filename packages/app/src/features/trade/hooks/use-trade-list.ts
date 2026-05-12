import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import type { BackendTradeAsset } from "@/services/api";

export interface TradeListData {
  assets: BackendTradeAsset[];
}

/**
 * Fetches the unified market list from backend /api/markets.
 * Backend has eager background refresh (60s TTL); frontend refetches every 30s.
 */
export function useTradeList() {
  return useQuery<BackendTradeAsset[], Error, TradeListData>({
    queryKey: queryKeys.marketData.markets(),
    queryFn: () => api.getMarkets() as Promise<BackendTradeAsset[]>,
    select: (payload) => ({
      assets: payload.filter((a) => !a.isDelisted),
    }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    gcTime: 300_000,
  });
}
