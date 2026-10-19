import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@/stores/use-app-store";

export function usePortfolio(enabled: boolean = true) {
  const { address } = useAccount();
  const viewedAddress = useAppStore((s) => s.viewedAddress);
  const effectiveAddress = address ?? viewedAddress;
  const walletAddress = effectiveAddress ?? "";
  return useQuery({
    queryKey: queryKeys.user.portfolio(walletAddress),
    queryFn: () => api.getPortfolio(walletAddress),
    enabled: enabled && !!effectiveAddress,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserVaultEquities(enabled: boolean = true) {
  const { address } = useAccount();
  const viewedAddress = useAppStore((s) => s.viewedAddress);
  const effectiveAddress = address ?? viewedAddress;
  const walletAddress = effectiveAddress ?? "";
  return useQuery({
    queryKey: queryKeys.user.vaultEquities(walletAddress),
    queryFn: () => api.getUserVaultEquities(walletAddress),
    enabled: enabled && !!effectiveAddress,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
