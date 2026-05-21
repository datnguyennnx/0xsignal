/**
 * Portfolio Page — overview of account balances, positions, PnL, and history.
 *
 * Top row layout (revised):
 *   col-span-5: PortfolioSummaryCard  — Perps / Spot / Vaults tabbed metrics
 *   col-span-7: PortfolioPnLChart     — step chart with timeframe + view controls
 *
 * VolumeCard is surfaced as a compact inline stat inside the summary card header
 * rather than its own full panel. The VolumeHistoryDialog is still accessible.
 *
 * Bottom: PortfolioTables
 */
import { useEffect } from "react";
import { PortfolioSummaryCard } from "@/features/portfolio/components/PortfolioSummaryCard";
import { PortfolioPnLChart } from "@/features/portfolio/components/PortfolioPnLChart";
import { PortfolioTables } from "@/features/portfolio/components/PortfolioTables";
import { ErrorBoundary } from "@/components/error-boundary";

export type PortfolioScope = "perps" | "spot" | "vaults";

export function PortfolioPage() {
  useEffect(() => {
    document.title = "Portfolio | 0xsignal";
  }, []);

  return (
    <div className="container-fluid py-6 space-y-6 animate-in fade-in duration-200 ease-premium">
      <h1 className="text-xl font-display font-semibold">Portfolio</h1>

      {/* ── Top row: Summary + Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <ErrorBoundary>
            <PortfolioSummaryCard />
          </ErrorBoundary>
        </div>
        <div className="lg:col-span-7">
          <ErrorBoundary>
            <PortfolioPnLChart />
          </ErrorBoundary>
        </div>
      </div>

      {/* ── Tables ── */}
      <ErrorBoundary>
        <PortfolioTables />
      </ErrorBoundary>
    </div>
  );
}
