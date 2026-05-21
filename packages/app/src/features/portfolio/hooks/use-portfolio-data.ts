/**
 * React Query hooks for portfolio data.
 *
 * Provides access to the new portfolio API endpoints:
 * - Portfolio metrics (accountValueHistory, pnlHistory, vlm across periods)
 * - Vault equities
 * - Funding history
 * - Combined portfolio summary
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import {
  useClearinghouseState,
  useSpotClearinghouseState,
} from "@/features/trade/hooks/use-user-data";

export function usePortfolio(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.userData.portfolio(),
    queryFn: () => api.getPortfolio(),
    enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserVaultEquities(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.userData.vaultEquities(),
    queryFn: () => api.getUserVaultEquities(),
    enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserFunding(startTime?: number, endTime?: number, enabled: boolean = true) {
  return useQuery({
    queryKey: [...queryKeys.userData.userFunding(), startTime, endTime] as const,
    queryFn: () => api.getUserFunding(startTime, endTime),
    enabled,
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

export function usePortfolioSummary(enabled: boolean = true): {
  data: PortfolioSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const chQuery = useClearinghouseState(enabled);
  const spotQuery = useSpotClearinghouseState(enabled);
  const vaultQuery = useUserVaultEquities(enabled);

  const isLoading = chQuery.isLoading || spotQuery.isLoading || vaultQuery.isLoading;
  const isError = chQuery.isError || spotQuery.isError || vaultQuery.isError;
  const error = chQuery.error ?? spotQuery.error ?? vaultQuery.error;

  const chData = chQuery.data;
  const spotData = spotQuery.data;
  const vaultData = vaultQuery.data;

  const data: PortfolioSummary | undefined =
    chData || spotData || vaultData
      ? {
          perpAccountValue: chData?.marginSummary ? Number(chData.marginSummary.accountValue) : 0,
          perpUnrealizedPnl: (chData?.assetPositions ?? []).reduce(
            (sum, p) => sum + Number(p.position.unrealizedPnl),
            0
          ),
          perpMarginRatio:
            chData?.marginSummary && Number(chData.marginSummary.accountValue) > 0
              ? (Number(chData.marginSummary.totalMarginUsed) /
                  Number(chData.marginSummary.accountValue)) *
                100
              : 0,
          perpLeverage:
            chData?.marginSummary && Number(chData.marginSummary.accountValue) > 0
              ? Number(chData.marginSummary.totalNtlPos) / Number(chData.marginSummary.accountValue)
              : 0,
          spotTotalUsdc: spotData?.balances
            ? spotData.balances.reduce(
                (sum, b) => sum + (b.coin === "USDC" ? Number(b.total) : 0),
                0
              )
            : 0,
          spotTokenCount: spotData?.balances?.length ?? 0,
          vaultTotalEquity: vaultData ? vaultData.reduce((sum, v) => sum + Number(v.equity), 0) : 0,
          vaultCount: vaultData?.length ?? 0,
        }
      : undefined;

  return { data, isLoading, isError, error };
}
