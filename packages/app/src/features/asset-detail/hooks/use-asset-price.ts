import { useQuery } from "@tanstack/react-query";
import { api, type MarketPrice } from "@/services/api";
import { isPageHidden } from "@/lib/page-visibility";
import { queryKeys } from "@/lib/query-keys";
import { toAsyncState } from "@/lib/async-state";

/** Keep the header quote moving without waiting for the 60s stale window. */
const ASSET_PRICE_REFRESH_MS = 20_000;

/** A hidden tab stops polling; otherwise refresh on the quote cadence. */
export function assetPriceRefetchInterval(): number | false {
  return isPageHidden() ? false : ASSET_PRICE_REFRESH_MS;
}

export function useAssetPrice(rawCoin: string) {
  const query = useQuery({
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

  // A failed refetch keeps the previous quote on screen (`ready`); only a first
  // load with no data becomes `error`.
  const state = toAsyncState<MarketPrice>({
    enabled: rawCoin !== "",
    isPending: query.isPending,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    isError: query.isError,
    error: query.error,
    data: query.data,
  });

  return { ...query, state };
}
