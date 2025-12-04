/**
 * Market Dashboard - Minimalist quant-focused design
 * High signal density, reduced cognitive load
 */

import type { AssetAnalysis, GlobalMarketData } from "@0xsignal/shared";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cachedTopAnalysis, cachedGlobalMarket } from "@/core/cache/effect-cache";
import { useEffectQuery, useConcurrentQueries } from "@/core/runtime/use-effect-query";
import { SignalCard } from "@/features/dashboard/components/signal-card";
import { TradeSetupCard } from "@/features/dashboard/components/trade-setup-card";
import { useMemoizedAllSignals } from "@/features/dashboard/hooks/use-memoized-calc";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CryptoIcon } from "@/components/crypto-icon";
import { MiniSparkline } from "@/features/dashboard/components/mini-sparkline";
import { ErrorState } from "@/components/error-state";
import {
  GlobalMarketBar,
  GlobalMarketBarSkeleton,
} from "@/features/dashboard/components/global-market-bar";
import { useResponsiveDataCount } from "@/core/hooks/use-responsive-data-count";

interface DashboardContentProps {
  analyses: AssetAnalysis[];
  globalMarket: GlobalMarketData | null;
}

function DashboardContent({ analyses, globalMarket }: DashboardContentProps) {
  const { buySignals, sellSignals, holdSignals, longEntries, shortEntries } =
    useMemoizedAllSignals(analyses);

  // Responsive data counts - Match grid columns to fill rows properly
  // Grid: 1 col mobile, 2 col tablet, 4 col desktop, 5 col xl, 6 col 3xl
  // Show 2 rows worth of data at each breakpoint
  const tradeSetupsCount = useResponsiveDataCount({
    mobile: 2,
    tablet: 4,
    desktop: 8,
    desktopWide: 10,
    desktop2xl: 12,
    desktop4k: 12,
  });
  const holdSignalsCount = useResponsiveDataCount({
    mobile: 8,
    tablet: 16,
    desktop: 30,
    desktop4k: 50,
  });
  const signalsCount = useResponsiveDataCount({ mobile: 4, tablet: 6, desktop: 8, desktop4k: 18 });

  // Combine and limit trade setups
  const tradeSetups = [...longEntries, ...shortEntries].slice(0, tradeSetupsCount);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="container-fluid py-4 sm:py-6">
        {/* Header - Stacked on mobile, inline on tablet+ */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-5 sm:mb-6 border-b border-border/40 pb-4">
          <h1 className="text-base sm:text-lg font-mono font-bold tracking-tight uppercase">
            Market Overview
          </h1>
          {globalMarket && <GlobalMarketBar data={globalMarket} />}
        </header>

        {/* Trade Setups - High Density Grid */}
        {tradeSetups.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                  Active Setups
                </h2>
                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-sm tabular-nums">
                  {longEntries.length + shortEntries.length}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-responsive">
              {tradeSetups.map((asset) => (
                <TradeSetupCard key={asset.symbol} asset={asset} />
              ))}
            </div>
          </section>
        )}

        {/* Hold - Compact Bar */}
        {holdSignals.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                Neutral / Hold
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                ({holdSignals.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-1.5">
              {holdSignals.slice(0, holdSignalsCount).map((s) => (
                <HoldChip key={s.symbol} asset={s} />
              ))}
              {holdSignals.length > holdSignalsCount && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 px-2.5 rounded-sm text-[10px] font-mono border-dashed"
                >
                  <Link to="/hold">+{holdSignals.length - holdSignalsCount}</Link>
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Long & Short - Split View or Full Width based on screen */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 xl:gap-8">
          {/* Long Signals */}
          <section>
            <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-mono font-medium text-gain uppercase tracking-wider">
                  Long Signals
                </h2>
                <span className="text-[10px] bg-gain-muted text-gain-dark px-1.5 py-0.5 rounded-sm tabular-nums">
                  {buySignals.length}
                </span>
              </div>
              {buySignals.length > signalsCount && (
                <Link
                  to="/buy"
                  className="text-[10px] font-mono hover:underline text-muted-foreground"
                >
                  VIEW ALL &rarr;
                </Link>
              )}
            </div>
            {buySignals.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-border/60 rounded-sm">
                <p className="text-xs text-muted-foreground font-mono">NO ACTIVE LONG SIGNALS</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-responsive">
                {buySignals.slice(0, signalsCount).map((s) => (
                  <SignalCard key={s.symbol} signal={s} type="buy" />
                ))}
              </div>
            )}
          </section>

          {/* Short Signals */}
          <section>
            <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-mono font-medium text-loss uppercase tracking-wider">
                  Short Signals
                </h2>
                <span className="text-[10px] bg-loss-muted text-loss-dark px-1.5 py-0.5 rounded-sm tabular-nums">
                  {sellSignals.length}
                </span>
              </div>
              {sellSignals.length > signalsCount && (
                <Link
                  to="/sell"
                  className="text-[10px] font-mono hover:underline text-muted-foreground"
                >
                  VIEW ALL &rarr;
                </Link>
              )}
            </div>
            {sellSignals.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-border/60 rounded-sm">
                <p className="text-xs text-muted-foreground font-mono">NO ACTIVE SHORT SIGNALS</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-responsive">
                {sellSignals.slice(0, signalsCount).map((s) => (
                  <SignalCard key={s.symbol} signal={s} type="sell" />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Hold chip - touch-friendly on mobile
function HoldChip({ asset }: { asset: AssetAnalysis }) {
  const change = asset.price?.change24h || 0;
  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className="h-8 sm:h-7 px-3 sm:px-2.5 rounded-full tap-highlight"
    >
      <Link to={`/asset/${asset.symbol.toLowerCase()}`}>
        <span className="font-mono text-[12px] sm:text-[11px]">{asset.symbol.toUpperCase()}</span>
        <span
          className={cn(
            "text-[11px] sm:text-[10px] tabular-nums ml-1.5",
            change >= 0 ? "text-gain" : "text-loss"
          )}
        >
          {change >= 0 ? "+" : ""}
          {change.toFixed(1)}%
        </span>
      </Link>
    </Button>
  );
}

// Loading skeleton
function DashboardSkeleton() {
  return (
    <div>
      <GlobalMarketBarSkeleton />
      <div className="container-fluid py-4 sm:py-6">
        <Skeleton className="h-6 w-20 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 mb-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[1, 2].map((col) => (
            <div key={col} className="space-y-2">
              <Skeleton className="h-5 w-20 mb-4" />
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MarketDashboard() {
  const { data, isLoading, isError, error } = useConcurrentQueries(
    {
      analyses: () => cachedTopAnalysis(100),
      globalMarket: () => cachedGlobalMarket(),
    },
    []
  );

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data?.analyses) {
    const errorObj = error as { status?: number; message?: string } | null;
    const isRateLimit = errorObj?.status === 429 || (errorObj?.message?.includes("429") ?? false);

    return (
      <div className="container-fluid py-6">
        <ErrorState
          type={isRateLimit ? "rate-limit" : "general"}
          retryAction={() => window.location.reload()}
        />
      </div>
    );
  }

  return <DashboardContent analyses={data.analyses} globalMarket={data.globalMarket} />;
}
