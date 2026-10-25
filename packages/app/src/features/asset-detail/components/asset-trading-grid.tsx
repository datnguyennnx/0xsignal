import { lazy, Suspense, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { OrderbookWidget } from "@/features/trade/components/orderbook-widget";
import { PositionManagement } from "@/features/trade/components/position-management";
import { OrderForm } from "@/features/trade/components/order-form";
import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import { UserStreamFailureAlert } from "@/features/trade/components/user-stream-failure-alert";
import { DashboardGrid, DashboardPanel } from "./dashboard-grid";

const TradingChart = lazy(() =>
  import("@/features/chart/components/trading-chart").then((m) => ({ default: m.TradingChart })),
);

const ChartSkeleton = () => (
  <div className="h-full w-full flex items-center justify-center panel-surface rounded-[var(--radius-panel)]">
    <Skeleton className="h-full w-full rounded-xl bg-muted/50" />
  </div>
);

const WIDE_BREAKPOINT_REM = 80;

/** Measures the container itself, since the two layouts must never be mounted together. */
function useWideContainer(ref: RefObject<HTMLDivElement | null>): boolean {
  const [isWide, setIsWide] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    const rootFontSize = Number(
      getComputedStyle(document.documentElement).fontSize.replace("px", ""),
    );
    const breakpointPx = (Number.isFinite(rootFontSize) ? rootFontSize : 16) * WIDE_BREAKPOINT_REM;
    const update = (width: number): void => {
      setIsWide(width >= breakpointPx);
    };
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        update(entry.contentRect.width);
      }
    });

    if (element !== null) {
      update(element.getBoundingClientRect().width);
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return isWide;
}

interface AssetTradingGridProps {
  readonly symbol: string;
  readonly interval: string;
  readonly onIntervalChange: (interval: string) => void;
  readonly showChartSkeleton: boolean;
  readonly markPrice: number;
}

export function AssetTradingGrid({
  symbol,
  interval,
  onIntervalChange,
  showChartSkeleton,
  markPrice,
}: AssetTradingGridProps) {
  const chartSymbol = symbol.toUpperCase();
  const containerRef = useRef<HTMLDivElement>(null);
  const isWide = useWideContainer(containerRef);
  const { getAssetIndex, isLoading: metaLoading } = useHyperliquidMeta();
  const assetIndex = getAssetIndex(symbol);

  const chartPanel = showChartSkeleton ? (
    <Skeleton className="h-full w-full rounded-lg" />
  ) : (
    <Suspense fallback={<ChartSkeleton />}>
      <ErrorBoundary resetKey={chartSymbol}>
        <TradingChart
          key={chartSymbol}
          symbol={chartSymbol}
          interval={interval}
          onIntervalChange={onIntervalChange}
        />
      </ErrorBoundary>
    </Suspense>
  );

  const orderbookPanel = (
    <ErrorBoundary resetKey={symbol}>
      <OrderbookWidget key={symbol} symbol={symbol} />
    </ErrorBoundary>
  );

  const orderformPanel =
    assetIndex === null ? (
      <ErrorBoundary resetKey={symbol}>
        <div className="h-full flex items-center justify-center rounded-[var(--radius-panel)] p-[var(--panel-pad,1.08rem)] panel-surface text-center text-[length:var(--text-compact)] text-muted-foreground">
          {metaLoading
            ? "Resolving market metadata…"
            : `Trading is disabled: no Hyperliquid asset index is known for ${symbol}.`}
        </div>
      </ErrorBoundary>
    ) : (
      <ErrorBoundary resetKey={symbol}>
        <OrderForm symbol={symbol} assetIndex={assetIndex} markPrice={markPrice} />
      </ErrorBoundary>
    );

  const positionsPanel = (
    <ErrorBoundary resetKey={symbol}>
      <PositionManagement />
    </ErrorBoundary>
  );

  return (
    <div ref={containerRef} className="container-query flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-end gap-2 pb-1">
        <UserStreamFailureAlert />
      </div>
      {isWide ? (
        /* ===== WIDE (container ≥ 80rem): layout-driven canvas =====
           Panels are absolutely placed inside a canvas whose height follows the row count,
           so the default row band fills the region and a bigger user layout grows the
           canvas (the page scrolls) instead of clipping a panel. Each panel still scrolls
           internally when its own content exceeds it. */
        <div className="flex flex-1 min-h-0 flex-col">
          <DashboardGrid>
            <DashboardPanel id="chart">{chartPanel}</DashboardPanel>
            <DashboardPanel id="orderbook">{orderbookPanel}</DashboardPanel>
            <DashboardPanel id="orderform">
              <div className="panel-contain-layout h-full">{orderformPanel}</div>
            </DashboardPanel>
            <DashboardPanel id="positions">
              <div className="panel-contain-layout h-full">{positionsPanel}</div>
            </DashboardPanel>
          </DashboardGrid>
        </div>
      ) : (
        /* ===== NARROW (container < 80rem): 2×2 Grid =====
           Definite 1fr/1fr tracks — the split the pre-hydration skeleton reserves — so
           late data cannot resize the rows. */
        <div className="grid flex-1 min-h-0 grid-cols-[7fr_3fr] grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-[clamp(0.25rem,0.5vw,0.5rem)]">
          {/* Row 1 */}
          <div className="min-w-0 h-full min-h-0">
            <div className="h-full">{chartPanel}</div>
          </div>

          <div className="flex flex-col h-full min-h-0 min-w-0">{orderbookPanel}</div>

          {/* Row 2 */}
          {/* PositionManagement does not own a height, so the cell stretches it to the
              track; both cells scroll instead of spilling past the track. */}
          <div className="flex flex-col h-full min-h-0 min-w-0 overflow-y-auto panel-contain-layout [&>*]:min-h-full">
            {positionsPanel}
          </div>

          <div className="flex flex-col h-full min-h-0 min-w-0 overflow-y-auto panel-contain-layout [&>*]:min-h-full">
            {orderformPanel}
          </div>
        </div>
      )}
    </div>
  );
}
