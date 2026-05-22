/**
 * Shared hook that computes derived balance values from clearinghouse + spot state.
 * Used by both PositionManagement and PortfolioTables.
 */
import { useMemo } from "react";
import { useClearinghouseState, useSpotClearinghouseState } from "./use-user-data";

export interface UserBalances {
  positions: Array<{
    position: {
      coin: string;
      positionValue: string;
      unrealizedPnl: string;
      returnOnEquity: string;
      szi: string;
      entryPx: string;
      liquidationPx: string | null;
      marginUsed: string;
      cumFunding: { sinceOpen: string };
    };
  }>;
  marginSummary:
    | {
        accountValue: string;
        totalNtlPos: string;
        totalRawUsd: string;
        totalMarginUsed: string;
      }
    | undefined;
  usdcTotalBalance: number;
  usdcAvailableBalance: number;
  totalUnrealizedPnl: number;
  effectiveAccountTotal: number;
  effectiveAvailableBalance: number;
  balanceCount: number;
  positionsCount: number;
  isChLoading: boolean;
}

export function useUserBalances(): UserBalances {
  const { data: chData, isLoading: isChLoading } = useClearinghouseState();
  const { data: spotData } = useSpotClearinghouseState();

  const positions = chData?.assetPositions;
  const marginSummary = chData?.marginSummary;
  const withdrawable = chData?.withdrawable;

  const spotUsdc = spotData?.balances?.find((b) => b.coin === "USDC");
  const spotUsdcTotal = spotUsdc ? Number(spotUsdc.total) : null;
  const spotUsdcHold = spotUsdc ? Number(spotUsdc.hold) : null;

  const usdcTotalBalance =
    spotUsdcTotal !== null ? spotUsdcTotal : Number(marginSummary?.totalRawUsd ?? 0);
  const usdcAvailableBalance =
    spotUsdcTotal !== null && spotUsdcHold !== null
      ? spotUsdcTotal - spotUsdcHold
      : Number(withdrawable ?? usdcTotalBalance);

  const accountValue = marginSummary ? Number(marginSummary.accountValue) : 0;
  const effectiveAccountTotal = accountValue > 0 ? accountValue : usdcTotalBalance;
  const perpsWithdrawable = Number(withdrawable ?? 0);
  const effectiveAvailableBalance = accountValue > 0 ? perpsWithdrawable : usdcAvailableBalance;

  const totalUnrealizedPnl = (positions ?? []).reduce(
    (sum, p) => sum + Number(p.position.unrealizedPnl),
    0
  );

  const balanceCount = marginSummary ? 2 + (positions?.length ?? 0) : 0;
  const positionsCount = positions?.length ?? 0;

  return useMemo(
    () => ({
      positions: positions ?? [],
      marginSummary,
      usdcTotalBalance,
      usdcAvailableBalance,
      totalUnrealizedPnl,
      effectiveAccountTotal,
      effectiveAvailableBalance,
      balanceCount,
      positionsCount,
      isChLoading,
    }),
    [
      positions,
      marginSummary,
      usdcTotalBalance,
      usdcAvailableBalance,
      totalUnrealizedPnl,
      effectiveAccountTotal,
      effectiveAvailableBalance,
      balanceCount,
      positionsCount,
      isChLoading,
    ]
  );
}
