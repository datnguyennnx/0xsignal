import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { isPageHidden } from "@/lib/page-visibility";
import { queryKeys } from "@/lib/query-keys";

/** Keep the header quote moving without waiting for the 60s stale window. */
export const ASSET_PRICE_REFRESH_MS = 20_000;

/** A hidden tab stops polling; otherwise refresh on the quote cadence. */
export function assetPriceRefetchInterval(): number | false {
  return isPageHidden() ? false : ASSET_PRICE_REFRESH_MS;
}

export function useAssetPrice(rawCoin: string) {
  return useQuery({
    queryKey: queryKeys.asset.price(rawCoin),
    queryFn: () => api.getMarketPrice(rawCoin),
    enabled: !!rawCoin,
    staleTime: 60 * 1000,
    refetchInterval: assetPriceRefetchInterval,
    refetchOnMount: true,
    retry: 1,
    // Keep the previous quote only for the same coin: carrying another coin's
    // price into the new key would label its numbers with the new ticker.
    placeholderData: (previousData, previousQuery) => {
      if (previousData === undefined || previousQuery === undefined) return previousData;
      return previousQuery.queryKey[2] === rawCoin ? previousData : undefined;
    },
  });
}
