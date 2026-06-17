import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";

export function usePortfolio(enabled: boolean = true) {
  const { address } = useAccount();
  const walletAddress = address ?? "";
  return useQuery({
    queryKey: queryKeys.user.portfolio(walletAddress),
    queryFn: () => api.getPortfolio(walletAddress),
    enabled: enabled && !!address,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserVaultEquities(enabled: boolean = true) {
  const { address } = useAccount();
  const walletAddress = address ?? "";
  return useQuery({
    queryKey: queryKeys.user.vaultEquities(walletAddress),
    queryFn: () => api.getUserVaultEquities(walletAddress),
    enabled: enabled && !!address,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export { useUserFunding } from "@/hooks/use-user-funding";
