import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import { useEffectiveAddress } from "@/hooks/use-effective-address";
import { useAuthStore } from "@/stores/use-auth-store";

const isPresent = (value: string | null | undefined): boolean =>
  value !== null && value !== undefined && value !== "";

/** User data is both wallet-scoped and auth-scoped; either missing half means no request. */
function useUserQueryGate(enabled: boolean) {
  const effectiveAddress = useEffectiveAddress();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return {
    walletAddress: effectiveAddress ?? "",
    enabled: enabled && isAuthenticated && isPresent(effectiveAddress),
  };
}

export function useClearinghouseState(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  return useQuery({
    queryKey: queryKeys.user.clearinghouseState(gate.walletAddress),
    queryFn: () => api.getUserClearinghouseState(gate.walletAddress),
    enabled: gate.enabled,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useSpotClearinghouseState(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  return useQuery({
    queryKey: queryKeys.user.spotClearinghouseState(gate.walletAddress),
    queryFn: () => api.getUserSpotClearinghouseState(gate.walletAddress),
    enabled: gate.enabled,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useOpenOrders(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  return useQuery({
    queryKey: queryKeys.user.openOrders(gate.walletAddress),
    queryFn: () => api.getUserFrontendOpenOrders(gate.walletAddress),
    enabled: gate.enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useHistoricalOrders(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  return useQuery({
    queryKey: queryKeys.user.historicalOrders(gate.walletAddress),
    queryFn: () => api.getUserHistoricalOrders(gate.walletAddress),
    enabled: gate.enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserFills(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  return useQuery({
    queryKey: queryKeys.user.fills(gate.walletAddress),
    queryFn: () => api.getUserFills(gate.walletAddress),
    enabled: gate.enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useCancelOrdersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof api.cancelOrders>[0]) => api.cancelOrders(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
    },
  });
}
