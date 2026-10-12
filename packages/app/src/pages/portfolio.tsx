import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PortfolioSummaryCard } from "@/features/portfolio/components/portfolio-summary-card";
import { PortfolioPnLChart } from "@/features/portfolio/components/portfolio-pnl-chart";
import { PositionManagement } from "@/features/trade/components/position-management";
import { ErrorBoundary } from "@/components/error-boundary";

export type PortfolioScope = "perps" | "spot" | "vaults";

export function PortfolioPage() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = "Portfolio | 0xsignal";
  }, []);

  return (
    <div className="container-fluid py-6 space-y-6 animate-in fade-in duration-200 ease-premium">
      <h1 className="sr-only">Portfolio</h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <ErrorBoundary resetKey={pathname}>
            <PortfolioSummaryCard />
          </ErrorBoundary>
        </div>
        <div className="lg:col-span-7">
          <ErrorBoundary resetKey={pathname}>
            <PortfolioPnLChart />
          </ErrorBoundary>
        </div>
      </div>

      <ErrorBoundary resetKey={pathname}>
        <PositionManagement />
      </ErrorBoundary>
    </div>
  );
}
