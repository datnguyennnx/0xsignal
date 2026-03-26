import { useQuery } from "@tanstack/react-query";
import { hyperliquidApi } from "@/services/hyperliquid";
import { queryKeys } from "@/lib/query/query-keys";
import { parseSymbol } from "./use-hyperliquid-ws";

export function usePerpAnnotation(symbol: string) {
  const coin = parseSymbol(symbol).coin;

  return useQuery({
    queryKey: queryKeys.hyperliquid.perpAnnotation(coin),
    queryFn: () => hyperliquidApi.getPerpAnnotation(coin),
    enabled: !!coin,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
