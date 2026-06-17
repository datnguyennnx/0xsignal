import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import { parseSymbol } from "../lib/symbol";

export function useTradeAnnotation(symbol: string) {
  const coin = parseSymbol(symbol).coin;

  return useQuery({
    queryKey: queryKeys.asset.annotation(coin),
    queryFn: async () => {
      const payload = await api.getTradeAnnotation(coin);
      return payload.annotation ?? null;
    },
    enabled: !!coin,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
