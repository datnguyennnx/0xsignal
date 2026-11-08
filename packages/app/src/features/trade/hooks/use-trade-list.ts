import { useQuery } from "@tanstack/react-query";
import { getMarkets } from "@/services/api/market";
import { queryKeys } from "@/lib/query-keys";
import type { AggregatedMarket } from "@0xsignal/shared";

export interface TradeListData {
  assets: AggregatedMarket[];
}

/**
 * Drops delisted rows only. Liveness is the dropdown's concern: the asset page
 * resolves its header data from this same list, so dead markets must survive.
 */
export function selectListedAssets(payload: readonly AggregatedMarket[]): TradeListData {
  return {
    assets: payload.filter((a) => !a.isDelisted),
  };
}

/**
 * Fetches the unified market list from backend /api/markets.
 * Market list changes rarely (new coin listings); prices update via WS.
 * Pass `enabled: false` to defer loading (intent-driven trade dropdown).
 */
export function useTradeList(enabled = true) {
  return useQuery<AggregatedMarket[], Error, TradeListData>({
    queryKey: queryKeys.market.meta(),
    queryFn: (): Promise<AggregatedMarket[]> => getMarkets(),
    select: selectListedAssets,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled,
  });
}
