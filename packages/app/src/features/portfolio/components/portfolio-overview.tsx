import { lazy, Suspense, useMemo, useState } from "react";
import { useLocation } from "react-router";
import type { PortfolioResponse } from "@0xsignal/shared";
import { ErrorBoundary } from "@/components/error-boundary";
import { Region } from "@/components/region";
import { Surface } from "@/components/surface/surface";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnAddress } from "@/hooks/use-effective-address";
import { toAsyncState, type AsyncState } from "@/lib/async-state";
import { PortfolioSummaryCard } from "@/features/portfolio/components/portfolio-summary-card";
import { usePortfolio, useWhalePortfolio } from "@/features/portfolio/hooks/use-portfolio-data";
import { preloadPnlChart } from "@/features/portfolio/lib/preload-pnl-chart";
import {
  PERPS_PERIOD,
  periodSlot,
  type PortfolioPeriod,
} from "@/features/portfolio/utils/constants";

import type { ChartView } from "./portfolio-pnl-chart";
import { SURFACE } from "./portfolio-summary.constants";

const PortfolioPnLChart = lazy(() =>
  preloadPnlChart().then((m) => ({ default: m.PortfolioPnLChart })),
);

const CHART_MIN_HEIGHT = "min-h-(--panel-state-min-h)";

/** Same header + plot geometry as the loaded panel, so the box cannot jump. */
function ChartSkeleton() {
  return (
    <>
      <div className="flex h-control shrink-0 items-center justify-between">
        <div className="flex gap-inline">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <Skeleton className="h-3.5 w-14" />
      </div>
      <div className={`flex flex-1 items-center justify-center ${CHART_MIN_HEIGHT}`}>
        <Skeleton className={`w-full ${CHART_MIN_HEIGHT}`} />
      </div>
    </>
  );
}

/** The plotted series the empty decision is made from, so it never needs chart code. */
function pnlValues(
  portfolio: PortfolioResponse | undefined,
  chartView: ChartView,
  timePeriod: PortfolioPeriod,
): [number, number][] | null {
  if (portfolio === undefined) return null;
  const periodKey = chartView === "perps-pnl" ? PERPS_PERIOD[timePeriod] : timePeriod;
  const entry = portfolio[periodSlot(periodKey)];
  if (entry === undefined) return null;
  const period = entry[1];
  const rawData: [number, string][] =
    chartView === "account-value" ? period.accountValueHistory : period.pnlHistory;
  const result: [number, number][] = [];
  for (let i = 0; i < rawData.length; i++) {
    const ts = rawData[i][0];
    const val = Number(rawData[i][1]);
    if (ts > 0 && Number.isFinite(val)) result.push([ts, val]);
  }
  return result.length > 0 ? result : null;
}

interface PortfolioOverviewProps {
  readOnlyAddress?: string | undefined;
}

/**
 * Summary and chart for one account. The card state is decided here, above the
 * lazy boundary, so an empty or failed panel paints without the chart chunk.
 */
export function PortfolioOverview({ readOnlyAddress }: PortfolioOverviewProps) {
  const { pathname } = useLocation();
  const [period, setPeriod] = useState<PortfolioPeriod>("month");
  const [chartView, setChartView] = useState<ChartView>("account-value");

  const isOwn = readOnlyAddress === undefined;
  const ownAddress = useOwnAddress();
  const ownPortfolio = usePortfolio(isOwn);
  const whalePortfolio = useWhalePortfolio(readOnlyAddress);
  const { data: portfolio, isLoading, isError, refetch } = isOwn ? ownPortfolio : whalePortfolio;

  const values = useMemo(
    () => pnlValues(portfolio, chartView, period),
    [portfolio, chartView, period],
  );

  const hasWallet = !isOwn || ownAddress !== undefined;
  const state: AsyncState<PortfolioResponse> = hasWallet
    ? toAsyncState({
        isPending: isLoading,
        isError,
        data: portfolio,
        isEmpty: () => values === null,
      })
    : { status: "empty", reason: "first-use" };

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
          <Surface tier="content" className={SURFACE}>
            <Region
              state={state}
              label="Portfolio PnL"
              className="flex min-h-0 flex-1 flex-col gap-stack"
              skeleton={<ChartSkeleton />}
              empty={{
                title: "No PnL history",
                description: isOwn
                  ? "Connect your wallet to see your PnL history."
                  : "This account has no PnL history for the selected range.",
              }}
              error={{
                title: "Unable to load PnL",
                description: isOwn
                  ? "Your PnL history could not be loaded. Please try again."
                  : "This account's PnL history could not be loaded. Please try again.",
                retry: () => {
                  void refetch();
                },
              }}
            >
              {() => (
                <Suspense fallback={<ChartSkeleton />}>
                  <PortfolioPnLChart
                    values={values}
                    chartView={chartView}
                    onChartViewChange={setChartView}
                    period={period}
                    onPeriodChange={setPeriod}
                  />
                </Suspense>
              )}
            </Region>
          </Surface>
        </ErrorBoundary>
      </div>
    </div>
  );
}
