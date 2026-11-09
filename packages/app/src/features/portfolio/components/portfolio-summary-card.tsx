import { Surface } from "@/components/surface/surface";

import { usePortfolioSummaryData } from "../hooks/use-portfolio-summary-data";
import type { PortfolioPeriod } from "../utils/constants";
import { selectPortfolioSummaryGateState } from "../utils/summary-derivations";
import { SURFACE } from "./portfolio-summary.constants";
import { PortfolioSummaryHeader } from "./portfolio-summary-header";
import { PortfolioSummarySections } from "./portfolio-summary-sections";
import { PortfolioSummaryGate } from "./portfolio-summary-states";

export function PortfolioSummaryCard({
  readOnlyAddress,
  period: selectedPeriod,
  onPeriodChange,
}: {
  readOnlyAddress?: string | undefined;
  period: PortfolioPeriod;
  onPeriodChange: (period: PortfolioPeriod) => void;
}) {
  const { isOwn, ownAddress, portfolio, isLoading, isError, retryAll, perps, spot, vaults } =
    usePortfolioSummaryData(readOnlyAddress, selectedPeriod);

  const state = selectPortfolioSummaryGateState({
    isOwn,
    ownAddress,
    isLoading,
    isError,
    portfolio,
  });

  if (state !== "ready") {
    return <PortfolioSummaryGate state={state} onRetry={retryAll} />;
  }

  return (
    <Surface tier="content" className={SURFACE}>
      <PortfolioSummaryHeader selectedPeriod={selectedPeriod} onPeriodChange={onPeriodChange} />

      <PortfolioSummarySections perps={perps} spot={spot} vaults={vaults} />
    </Surface>
  );
}
