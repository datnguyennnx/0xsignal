import { useLocation } from "react-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { PortfolioOverview } from "@/features/portfolio/components/portfolio-overview";
import { WhaleAccountPositions } from "@/features/portfolio/components/whale-account-positions";

/** A third party's portfolio: summary, chart, and their read-only positions. */
export function PortfolioWhaleView({ address }: { address: string }) {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-panel">
      <PortfolioOverview readOnlyAddress={address} />

      <ErrorBoundary resetKey={pathname}>
        <WhaleAccountPositions address={address} />
      </ErrorBoundary>
    </div>
  );
}
