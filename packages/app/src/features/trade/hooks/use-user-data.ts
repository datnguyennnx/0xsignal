import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";

export function useClearinghouseState(enabled: boolean = true) {
  const { address } = useAccount();
  const walletAddress = address ?? "";
  return useQuery({
    queryKey: queryKeys.user.clearinghouseState(walletAddress),
    queryFn: () => api.getUserClearinghouseState(walletAddress),
    enabled: enabled && !!address,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useSpotClearinghouseState(enabled: boolean = true) {
  const { address } = useAccount();
  const walletAddress = address ?? "";
  return useQuery({
    queryKey: queryKeys.user.spotClearinghouseState(walletAddress),
    queryFn: () => api.getUserSpotClearinghouseState(walletAddress),
    enabled: enabled && !!address,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useOpenOrders(enabled: boolean = true) {
  const { address } = useAccount();
  const walletAddress = address ?? "";
  return useQuery({
    queryKey: queryKeys.user.openOrders(walletAddress),
    queryFn: () => api.getUserFrontendOpenOrders(walletAddress),
    enabled: enabled && !!address,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useHistoricalOrders(enabled: boolean = true) {
  const { address } = useAccount();
  const walletAddress = address ?? "";
  return useQuery({
    queryKey: queryKeys.user.historicalOrders(walletAddress),
    queryFn: () => api.getUserHistoricalOrders(walletAddress),
    enabled: enabled && !!address,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserFills(enabled: boolean = true) {
  const { address } = useAccount();
  const walletAddress = address ?? "";
  return useQuery({
    queryKey: queryKeys.user.fills(walletAddress),
    queryFn: () => api.getUserFills(walletAddress),
    enabled: enabled && !!address,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useCancelOrdersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof api.cancelOrders>[0]) => api.cancelOrders(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
    },
  });
}
