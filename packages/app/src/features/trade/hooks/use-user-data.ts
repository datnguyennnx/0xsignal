/**
 * React Query hooks for user account data and order mutations.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";

export function useClearinghouseState(enabled: boolean = true) {
  const { address: walletAddress } = useAccount();
  return useQuery({
    queryKey: [...queryKeys.userData.clearinghouseState(), walletAddress],
    queryFn: () => api.getUserClearinghouseState(walletAddress!),
    enabled: enabled && !!walletAddress,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useSpotClearinghouseState(enabled: boolean = true) {
  const { address: walletAddress } = useAccount();
  return useQuery({
    queryKey: [...queryKeys.userData.spotClearinghouseState(), walletAddress],
    queryFn: () => api.getUserSpotClearinghouseState(walletAddress!),
    enabled: enabled && !!walletAddress,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useOpenOrders(enabled: boolean = true) {
  const { address: walletAddress } = useAccount();
  return useQuery({
    queryKey: [...queryKeys.userData.openOrders(), walletAddress],
    queryFn: () => api.getUserFrontendOpenOrders(walletAddress!),
    enabled: enabled && !!walletAddress,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useHistoricalOrders(enabled: boolean = true) {
  const { address: walletAddress } = useAccount();
  return useQuery({
    queryKey: [...queryKeys.userData.historicalOrders(), walletAddress],
    queryFn: () => api.getUserHistoricalOrders(walletAddress!),
    enabled: enabled && !!walletAddress,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserFills(enabled: boolean = true) {
  const { address: walletAddress } = useAccount();
  return useQuery({
    queryKey: [...queryKeys.userData.fills(), walletAddress],
    queryFn: () => api.getUserFills(walletAddress!),
    enabled: enabled && !!walletAddress,
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
