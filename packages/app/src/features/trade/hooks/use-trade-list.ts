import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import type { AggregatedMarket } from "@0xsignal/shared";

export interface TradeListData {
  assets: AggregatedMarket[];
}

/**
 * Fetches the unified market list from backend /api/markets.
 * Market list changes rarely (new coin listings); prices update via WS.
 * Pass `enabled: false` to defer loading (intent-driven trade dropdown).
 */
export function useTradeList(enabled = true) {
  return useQuery<AggregatedMarket[], Error, TradeListData>({
    queryKey: queryKeys.market.meta(),
    queryFn: (): Promise<AggregatedMarket[]> => api.getMarkets(),
    select: (payload) => ({
      assets: payload.filter((a) => !a.isDelisted),
    }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled,
  });
}
