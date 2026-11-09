import { lazy, Suspense, useState } from "react";
import { useLocation } from "react-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { Surface } from "@/components/surface/surface";
import { Skeleton } from "@/components/ui/skeleton";
import { PositionManagement } from "@/features/trade/components/position-management";
import { PortfolioSummaryCard } from "@/features/portfolio/components/portfolio-summary-card";
import { SURFACE } from "@/features/portfolio/components/portfolio-summary.constants";
import type { PortfolioPeriod } from "@/features/portfolio/utils/constants";

const PortfolioPnLChart = lazy(() =>
  import("@/features/portfolio/components/portfolio-pnl-chart").then((m) => ({
    default: m.PortfolioPnLChart,
  })),
);

/** Reserves the chart panel's height while the lazy chunk loads. */
const ChartSkeleton = () => (
  <Surface tier="content" className={SURFACE}>
    <Skeleton className="flex-1 min-h-(--panel-state-min-h)" />
  </Surface>
);

interface PortfolioOverviewProps {
  readOnlyAddress: string | undefined;
  pathname: string;
}

/** The period owner sits here, not above the trade region, so it never re-renders that panel. */
function PortfolioOverview({ readOnlyAddress, pathname }: PortfolioOverviewProps) {
  const [period, setPeriod] = useState<PortfolioPeriod>("month");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-panel">
      <div className="lg:col-span-5">
        <ErrorBoundary resetKey={pathname}>
          <PortfolioSummaryCard
            readOnlyAddress={readOnlyAddress}
            period={period}
            onPeriodChange={setPeriod}
          />
        </ErrorBoundary>
      </div>
      <div className="lg:col-span-7">
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<ChartSkeleton />}>
            <PortfolioPnLChart
              readOnlyAddress={readOnlyAddress}
              period={period}
              onPeriodChange={setPeriod}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export function PortfolioView({ readOnlyAddress }: { readOnlyAddress?: string | undefined }) {
  const { pathname } = useLocation();

  return (
    <>
      <PortfolioOverview readOnlyAddress={readOnlyAddress} pathname={pathname} />

      <ErrorBoundary resetKey={pathname}>
        <PositionManagement readOnlyAddress={readOnlyAddress} variant="flow" />
      </ErrorBoundary>
    </>
  );
}
