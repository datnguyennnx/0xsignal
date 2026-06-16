import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";

export function usePortfolio(enabled: boolean = true) {
  const { address: walletAddress } = useAccount();
  return useQuery({
    queryKey: [...queryKeys.userData.portfolio(), walletAddress],
    queryFn: () => api.getPortfolio(walletAddress!),
    enabled: enabled && !!walletAddress,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserVaultEquities(enabled: boolean = true) {
  const { address: walletAddress } = useAccount();
  return useQuery({
    queryKey: [...queryKeys.userData.vaultEquities(), walletAddress],
    queryFn: () => api.getUserVaultEquities(walletAddress!),
    enabled: enabled && !!walletAddress,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserFunding(startTime?: number, endTime?: number, enabled: boolean = true) {
  const { address: walletAddress } = useAccount();
  return useQuery({
    queryKey: [...queryKeys.userData.userFunding(), walletAddress, startTime, endTime] as const,
    queryFn: () => api.getUserFunding(walletAddress!, startTime, endTime),
    enabled: enabled && !!walletAddress,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export interface PortfolioSummary {
  perpAccountValue: number;
  perpUnrealizedPnl: number;
  perpMarginRatio: number;
  perpLeverage: number;
  spotTotalUsdc: number;
  spotTokenCount: number;
  vaultTotalEquity: number;
  vaultCount: number;
}
