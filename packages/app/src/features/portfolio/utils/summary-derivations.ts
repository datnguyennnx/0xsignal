import type {
  ClearinghouseState,
  PortfolioPeriod as PortfolioPeriodData,
  PortfolioResponse,
  SpotClearinghouseState,
  UserVaultEquity,
} from "@0xsignal/shared";

import { QUOTE_ASSET } from "@/core/utils/hyperliquid";
import { toAsyncState, type AsyncState } from "@/lib/async-state";

import { findPeriodEntry, type PortfolioPeriod } from "./constants";
import { computeMaxDrawdown } from "./financial";

export interface PortfolioSummaryPerps {
  readonly accountValue: number | null;
  readonly pnl: number | null;
  readonly volume: number | null;
  readonly maxDd: number | null;
}

export interface PortfolioSummarySpot {
  readonly totalUsdc: number;
}

export interface PortfolioSummaryVaults {
  readonly totalEquity: number;
}

/** Any pending/failed read keeps the whole summary in that state. */
export function anyQueryFlag(flags: readonly boolean[]): boolean {
  return flags.some(Boolean);
}

export function deriveSummaryPeriod(
  portfolio: PortfolioResponse | undefined,
  selectedPeriod: PortfolioPeriod,
): PortfolioPeriodData | null {
  if (!portfolio) return null;
  return findPeriodEntry(portfolio, selectedPeriod) ?? null;
}

export function deriveSummaryPerps(
  chData: ClearinghouseState | undefined,
  period: PortfolioPeriodData | null,
): PortfolioSummaryPerps {
  const lastAccountValue = period?.accountValueHistory?.at(-1);
  const portfolioAccountValue = lastAccountValue === undefined ? null : Number(lastAccountValue[1]);
  const marginSummary = chData?.marginSummary;
  const accountValue = marginSummary ? Number(marginSummary.accountValue) : portfolioAccountValue;
  const lastPnl = period?.pnlHistory?.at(-1);
  const pnl = lastPnl === undefined ? null : Number(lastPnl[1]);
  const volume = period?.vlm === undefined ? null : Number(period.vlm);
  const maxDd = period ? computeMaxDrawdown(period.accountValueHistory) : null;
  return { accountValue, pnl, volume, maxDd };
}

export function deriveSummarySpot(
  spotData: SpotClearinghouseState | undefined,
): PortfolioSummarySpot | null {
  if (!spotData?.balances) return null;
  const totalUsdc = spotData.balances.reduce(
    (sum, balance) => sum + (balance.coin === QUOTE_ASSET ? Number(balance.total) : 0),
    0,
  );
  return { totalUsdc };
}

export function deriveSummaryVaults(
  vaultData: UserVaultEquity[] | undefined,
): PortfolioSummaryVaults | null {
  if (!vaultData) return null;
  return { totalEquity: vaultData.reduce((sum, vault) => sum + Number(vault.equity), 0) };
}

export interface PortfolioSummaryGateInput {
  readonly isOwn: boolean;
  readonly ownAddress: string | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly portfolio: PortfolioResponse | undefined;
}

/**
 * A connected card that has finished loading without a portfolio is a
 * first-use account, not an idle region: idle would keep the skeleton forever.
 * An own card with no wallet has no query to wait on, so it is empty too.
 */
export function selectPortfolioSummaryState({
  isOwn,
  ownAddress,
  isLoading,
  isError,
  portfolio,
}: PortfolioSummaryGateInput): AsyncState<PortfolioResponse> {
  if (isOwn && ownAddress === undefined) return { status: "empty", reason: "first-use" };

  const state = toAsyncState<PortfolioResponse>({
    isPending: isLoading,
    isError,
    data: portfolio,
  });

  return state.status === "idle" ? { status: "empty", reason: "first-use" } : state;
}
