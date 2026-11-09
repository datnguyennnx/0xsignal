import type {
  ClearinghouseState,
  PortfolioPeriod as PortfolioPeriodData,
  PortfolioResponse,
  SpotClearinghouseState,
  UserVaultEquity,
} from "@0xsignal/shared";

import { QUOTE_ASSET } from "@/core/utils/hyperliquid";

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

/** Own and whale reads are structurally identical, so the owner flag selects one. */
export function selectSummarySource<T>(isOwn: boolean, own: T, whale: T): T {
  return isOwn ? own : whale;
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

export type PortfolioSummaryGateState = "connect-wallet" | "loading" | "error" | "empty" | "ready";

export interface PortfolioSummaryGateInput {
  readonly isOwn: boolean;
  readonly ownAddress: string | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly portfolio: PortfolioResponse | undefined;
}

/**
 * Branch order is the card's original early-return order. "empty" and "loading"
 * intentionally render the same skeleton: a missing portfolio read would
 * otherwise print placeholder rows as if the account were genuinely empty.
 */
export function selectPortfolioSummaryGateState({
  isOwn,
  ownAddress,
  isLoading,
  isError,
  portfolio,
}: PortfolioSummaryGateInput): PortfolioSummaryGateState {
  if (isOwn && ownAddress === undefined) return "connect-wallet";
  if (isLoading) return "loading";
  if (isError) return "error";
  if (portfolio === undefined) return "empty";
  return "ready";
}
