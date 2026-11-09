import { useMemo } from "react";

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
  selectSummarySource,
} from "../utils/summary-derivations";
import {
  usePortfolio,
  useUserVaultEquities,
  useWhaleClearinghouseState,
  useWhalePortfolio,
  useWhaleSpotClearinghouseState,
  useWhaleVaultEquities,
} from "./use-portfolio-data";

/**
 * Own/whale reads, their combined flags, refetch, and derived rows for the
 * portfolio summary card. Hook order matches the previous inline wiring: the
 * own and whale query pairs are always both called, then the four memos.
 */
export function usePortfolioSummaryData(
  readOnlyAddress: string | undefined,
  selectedPeriod: PortfolioPeriod,
) {
  const isOwn = readOnlyAddress === undefined;
  const ownAddress = useOwnAddress();

  const ownPortfolio = usePortfolio(isOwn);
  const whalePortfolio = useWhalePortfolio(readOnlyAddress);
  const portfolioQuery = selectSummarySource(isOwn, ownPortfolio, whalePortfolio);

  const ownClearinghouse = useClearinghouseState(isOwn);
  const whaleClearinghouse = useWhaleClearinghouseState(readOnlyAddress);
  const clearinghouseQuery = selectSummarySource(isOwn, ownClearinghouse, whaleClearinghouse);

  const ownSpot = useSpotClearinghouseState(isOwn);
  const whaleSpot = useWhaleSpotClearinghouseState(readOnlyAddress);
  const spotQuery = selectSummarySource(isOwn, ownSpot, whaleSpot);

  const ownVaults = useUserVaultEquities(isOwn);
  const whaleVaults = useWhaleVaultEquities(readOnlyAddress);
  const vaultQuery = selectSummarySource(isOwn, ownVaults, whaleVaults);

  const portfolio = portfolioQuery.data;
  const isLoading = anyQueryFlag([
    portfolioQuery.isLoading,
    clearinghouseQuery.isLoading,
    spotQuery.isLoading,
    vaultQuery.isLoading,
  ]);
  const isError = anyQueryFlag([
    portfolioQuery.isError,
    clearinghouseQuery.isError,
    spotQuery.isError,
    vaultQuery.isError,
  ]);
  const retryAll = () => {
    void portfolioQuery.refetch();
    void clearinghouseQuery.refetch();
    void spotQuery.refetch();
    void vaultQuery.refetch();
  };

  const period = useMemo(
    () => deriveSummaryPeriod(portfolio, selectedPeriod),
    [portfolio, selectedPeriod],
  );
  const perps = useMemo(
    () => deriveSummaryPerps(clearinghouseQuery.data, period),
    [clearinghouseQuery.data, period],
  );
  const spot = useMemo(() => deriveSummarySpot(spotQuery.data), [spotQuery.data]);
  const vaults = useMemo(() => deriveSummaryVaults(vaultQuery.data), [vaultQuery.data]);

  return {
    isOwn,
    ownAddress,
    portfolio,
    isLoading,
    isError,
    retryAll,
    perps,
    spot,
    vaults,
  };
}
