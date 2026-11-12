import type {
  ClearinghouseState,
  PortfolioResponse,
  SpotClearinghouseState,
  UserVaultEquity,
} from "@0xsignal/shared";

import {
  useClearinghouseState,
  useSpotClearinghouseState,
} from "@/features/trade/hooks/use-user-data";
import { useOwnAddress } from "@/hooks/use-effective-address";

import type { PortfolioPeriod } from "../utils/constants";
import {
  anyQueryFlag,
  deriveSummaryPeriod,
  deriveSummaryPerps,
  deriveSummarySpot,
  deriveSummaryVaults,
  selectPortfolioSummaryState,
} from "../utils/summary-derivations";
import {
  usePortfolio,
  useUserVaultEquities,
  useWhaleClearinghouseState,
  useWhalePortfolio,
  useWhaleSpotClearinghouseState,
  useWhaleVaultEquities,
} from "./use-portfolio-data";

interface SummaryQuery<T> {
  readonly data: T | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly refetch: () => Promise<unknown>;
}

function summarize(
  portfolioQuery: SummaryQuery<PortfolioResponse>,
  clearinghouseQuery: SummaryQuery<ClearinghouseState>,
  spotQuery: SummaryQuery<SpotClearinghouseState>,
  vaultQuery: SummaryQuery<UserVaultEquity[]>,
  selectedPeriod: PortfolioPeriod,
) {
  const portfolio = portfolioQuery.data;
  const period = deriveSummaryPeriod(portfolio, selectedPeriod);

  return {
    portfolio,
    isLoading: anyQueryFlag([
      portfolioQuery.isLoading,
      clearinghouseQuery.isLoading,
      spotQuery.isLoading,
      vaultQuery.isLoading,
    ]),
    isError: anyQueryFlag([
      portfolioQuery.isError,
      clearinghouseQuery.isError,
      spotQuery.isError,
      vaultQuery.isError,
    ]),
    retryAll: () => {
      void portfolioQuery.refetch();
      void clearinghouseQuery.refetch();
      void spotQuery.refetch();
      void vaultQuery.refetch();
    },
    perps: deriveSummaryPerps(clearinghouseQuery.data, period),
    spot: deriveSummarySpot(spotQuery.data),
    vaults: deriveSummaryVaults(vaultQuery.data),
  };
}

function useOwnSummary(selectedPeriod: PortfolioPeriod, enabled: boolean) {
  return summarize(
    usePortfolio(enabled),
    useClearinghouseState(enabled),
    useSpotClearinghouseState(enabled),
    useUserVaultEquities(enabled),
    selectedPeriod,
  );
}

function useWhaleSummary(address: string | undefined, selectedPeriod: PortfolioPeriod) {
  return summarize(
    useWhalePortfolio(address),
    useWhaleClearinghouseState(address),
    useWhaleSpotClearinghouseState(address),
    useWhaleVaultEquities(address),
    selectedPeriod,
  );
}

/**
 * Own and read-only summary data. Both quartets mount on every render so the
 * hook order is stable; the inactive one is gated off, so its queries never
 * start and its stream effects never subscribe. Only the shown quartet's
 * `retryAll` is ever called, so a retry never refetches the idle pair.
 */
export function usePortfolioSummaryData(
  readOnlyAddress: string | undefined,
  selectedPeriod: PortfolioPeriod,
) {
  const isOwn = readOnlyAddress === undefined;
  const ownAddress = useOwnAddress();

  const ownSummary = useOwnSummary(selectedPeriod, isOwn);
  const whaleSummary = useWhaleSummary(isOwn ? undefined : readOnlyAddress, selectedPeriod);
  const summary = isOwn ? ownSummary : whaleSummary;

  const needsWallet = isOwn && ownAddress === undefined;
  const state = selectPortfolioSummaryState({
    isOwn,
    ownAddress,
    isLoading: summary.isLoading,
    isError: summary.isError,
    portfolio: summary.portfolio,
  });

  return { ownAddress, ...summary, needsWallet, state };
}
