import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import { useEffectiveAddress } from "@/hooks/use-effective-address";

export function usePortfolio(enabled: boolean = true) {
  const effectiveAddress = useEffectiveAddress();
  const walletAddress = effectiveAddress ?? "";
  return useQuery({
    queryKey: queryKeys.user.portfolio(walletAddress),
    queryFn: () => api.getPortfolio(walletAddress),
    enabled: enabled && effectiveAddress !== undefined,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserVaultEquities(enabled: boolean = true) {
  const effectiveAddress = useEffectiveAddress();
  const walletAddress = effectiveAddress ?? "";
  return useQuery({
    queryKey: queryKeys.user.vaultEquities(walletAddress),
    queryFn: () => api.getUserVaultEquities(walletAddress),
    enabled: enabled && effectiveAddress !== undefined,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
