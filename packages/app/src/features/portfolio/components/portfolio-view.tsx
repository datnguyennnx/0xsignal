import { useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-boundary";
import { PositionManagement } from "@/features/trade/components/position-management";
import { PortfolioSummaryCard } from "@/features/portfolio/components/portfolio-summary-card";
import { PortfolioPnLChart } from "@/features/portfolio/components/portfolio-pnl-chart";

export function PortfolioView({ readOnlyAddress }: { readOnlyAddress?: string | undefined }) {
  const { pathname } = useLocation();

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <ErrorBoundary resetKey={pathname}>
            <PortfolioSummaryCard readOnlyAddress={readOnlyAddress} />
          </ErrorBoundary>
        </div>
        <div className="lg:col-span-7">
          <ErrorBoundary resetKey={pathname}>
            <PortfolioPnLChart readOnlyAddress={readOnlyAddress} />
          </ErrorBoundary>
        </div>
      </div>

      <ErrorBoundary resetKey={pathname}>
        <PositionManagement readOnlyAddress={readOnlyAddress} />
      </ErrorBoundary>
    </>
  );
}
