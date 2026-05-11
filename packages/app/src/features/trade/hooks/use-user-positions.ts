import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export function useSpotClearinghouseState(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.userData.spotClearinghouseState(),
    queryFn: () => api.getUserSpotClearinghouseState(),
    enabled,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useOpenOrders(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.userData.openOrders(),
    queryFn: () => api.getUserFrontendOpenOrders(),
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

export function useCancelOrdersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof api.cancelOrders>[0]) => api.cancelOrders(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.openOrders() });
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.clearinghouseState() });
    },
  });
}
