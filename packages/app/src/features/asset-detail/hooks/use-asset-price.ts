import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";

export function useAssetPrice(rawCoin: string) {
  return useQuery({
    queryKey: queryKeys.asset.price(rawCoin),
    queryFn: () => api.getMarketPrice(rawCoin),
    enabled: !!rawCoin,
    staleTime: 60 * 1000,
    refetchOnMount: true,
    retry: 1,
    // Show previous price data while loading next symbol
    placeholderData: (prev) => prev,
  });
}
