import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";

export function useClearinghouseState(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.userData.clearinghouseState(),
    queryFn: () => api.getUserClearinghouseState(),
    enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useOpenOrders(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.userData.openOrders(),
    queryFn: () => api.getUserOpenOrders(),
    enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useHistoricalOrders(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.userData.historicalOrders(),
    queryFn: () => api.getUserHistoricalOrders(),
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserFills(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.userData.fills(),
    queryFn: () => api.getUserFills(),
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
