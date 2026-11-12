import { useMemo } from "react";
import type { ClearinghouseState, SpotClearinghouseState } from "@0xsignal/shared";
import { toAsyncState, type AsyncState } from "@/lib/async-state";
import { useClearinghouseState, useSpotClearinghouseState } from "./use-user-data";
import {
  useWhaleClearinghouseState,
  useWhaleSpotClearinghouseState,
} from "@/features/portfolio/hooks/use-portfolio-data";

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
      leverage?: { type: "cross" | "isolated"; value?: number };
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

export type UserBalancesView = UserBalances & {
  state: AsyncState<ClearinghouseState>;
  refetch: () => void;
};

export function useUserBalances(enabled: boolean = true): UserBalancesView {
  const chQuery = useClearinghouseState(enabled);
  const { data: chData } = chQuery;
  const { data: spotData } = useSpotClearinghouseState(enabled);

  // A disabled query (no wallet, no auth) is "connect a wallet", not a spinner.
  const state = useMemo<AsyncState<ClearinghouseState>>(() => {
    if (chData === undefined && chQuery.fetchStatus === "idle" && !chQuery.isFetched) {
      return { status: "empty", reason: "first-use" };
    }
    return toAsyncState({
      isPending: chQuery.isPending,
      isFetching: chQuery.isFetching,
      isError: chQuery.isError,
      error: chQuery.error,
      data: chData,
    });
  }, [
    chData,
    chQuery.fetchStatus,
    chQuery.isFetched,
    chQuery.isPending,
    chQuery.isFetching,
    chQuery.isError,
    chQuery.error,
  ]);

  const refetch = chQuery.refetch;
  return useMemo(
    () => ({
      ...buildUserBalances(chData, spotData, chQuery.isLoading),
      state,
      refetch: () => {
        void refetch();
      },
    }),
    [chData, spotData, chQuery.isLoading, state, refetch],
  );
}

/** Read-only balance view for a third party, fed only by the public readers. */
export function useWhaleBalances(address?: string): UserBalances {
  const { data: chData, isLoading: isChLoading } = useWhaleClearinghouseState(address);
  const { data: spotData } = useWhaleSpotClearinghouseState(address);
  return useMemo(
    () => buildUserBalances(chData, spotData, isChLoading),
    [chData, spotData, isChLoading],
  );
}

function buildUserBalances(
  chData: ClearinghouseState | undefined,
  spotData: SpotClearinghouseState | undefined,
  isChLoading: boolean,
): UserBalances {
  const positions = chData?.assetPositions;
  const marginSummary = chData?.marginSummary;
  const withdrawable = chData?.withdrawable;

  const spotUsdc = spotData?.balances?.find((b) => b.coin === "USDC");
  const spotUsdcTotal = spotUsdc ? Number(spotUsdc.total) : null;
  const spotUsdcHold = spotUsdc ? Number(spotUsdc.hold) : null;

  const usdcTotalBalance = spotUsdcTotal ?? Number(marginSummary?.totalRawUsd ?? 0);
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
    0,
  );

  const balanceCount = marginSummary ? 2 + (positions?.length ?? 0) : 0;
  const positionsCount = positions?.length ?? 0;

  return {
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
  };
}
