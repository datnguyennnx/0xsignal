import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";

export function useAssetPrice(rawCoin: string) {
  return useQuery({
    queryKey: queryKeys.asset.price(rawCoin),
    queryFn: () => api.getMarketPrice(rawCoin),
    enabled: !!rawCoin,
    staleTime: 60 * 1000,
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
