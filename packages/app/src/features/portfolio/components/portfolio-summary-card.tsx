import { Surface } from "@/components/surface/surface";

import { usePortfolioSummaryData } from "../hooks/use-portfolio-summary-data";
import type { PortfolioPeriod } from "../utils/constants";
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
  const { needsWallet, state, retryAll, perps, spot, vaults } = usePortfolioSummaryData(
    readOnlyAddress,
    selectedPeriod,
  );

  const empty = needsWallet
    ? {
        title: "Connect your wallet",
        description: "Connect your wallet to see your portfolio.",
      }
    : {
        title: "No portfolio yet",
        description: "Your portfolio will appear here after your first trade.",
      };

  return (
    <Surface tier="content" className={SURFACE}>
      <PortfolioSummaryGate state={state} onRetry={retryAll} empty={empty}>
        {() => (
          <>
            <PortfolioSummaryHeader
              selectedPeriod={selectedPeriod}
              onPeriodChange={onPeriodChange}
            />

            <PortfolioSummarySections perps={perps} spot={spot} vaults={vaults} />
          </>
        )}
      </PortfolioSummaryGate>
    </Surface>
  );
}
