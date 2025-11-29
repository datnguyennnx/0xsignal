// Market Dashboard - Mobile-first responsive design

import type { AssetAnalysis } from "@0xsignal/shared";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cachedTopAnalysis } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { SignalCard } from "@/features/dashboard/components/signal-card";
import { HoldCard } from "@/features/dashboard/components/hold-card";
import { useMemoizedSignals } from "@/features/dashboard/hooks/use-memoized-calc";

const fetchDashboardData = () => cachedTopAnalysis(100);

function DashboardContent({ analyses }: { analyses: AssetAnalysis[] }) {
  const { buySignals, sellSignals, holdSignals } = useMemoizedSignals(analyses);

  // Pre-compute stats once - React Compiler will optimize
  const stats = {
    total: buySignals.length + sellSignals.length,
    strongBuys: buySignals.filter((s) => s.overallSignal === "STRONG_BUY").length,
    strongSells: sellSignals.filter((s) => s.overallSignal === "STRONG_SELL").length,
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-base sm:text-lg font-medium">Trading Signals</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            {stats.total} active · {stats.strongBuys + stats.strongSells} strong
          </p>
        </div>
        <div className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
          <span className="text-gain">{buySignals.length} long</span>
          <span className="mx-1">·</span>
          <span className="text-loss">{sellSignals.length} short</span>
        </div>
      </div>

      {/* Hold Section - Scrollable on mobile */}
      {holdSignals.length > 0 && (
        <div className="pb-4 mb-4 sm:pb-6 sm:mb-6 border-b border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <Link
              to="/hold"
              className="text-[10px] sm:text-xs text-muted-foreground/60 hover:text-muted-foreground"
            >
              Hold ({holdSignals.length})
            </Link>
          </div>
          {/* Horizontal scroll on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
            {holdSignals.slice(0, 20).map((signal) => (
              <HoldCard key={signal.symbol} signal={signal} />
            ))}
            {holdSignals.length > 20 && (
              <Link
                to="/hold"
                className="flex items-center text-[10px] text-muted-foreground hover:text-foreground whitespace-nowrap px-2"
              >
                +{holdSignals.length - 20}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Long & Short - Stack on mobile, 2 columns on desktop */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
        {/* Long Signals */}
        <section>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Long</h2>
              <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
                {buySignals.length}
              </span>
            </div>
            {buySignals.length > 5 && (
              <Link
                to="/buy"
                className="flex items-center text-[10px] sm:text-xs text-muted-foreground hover:text-foreground"
              >
                All <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {buySignals.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No buy signals detected in current market conditions
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {/* Show 5 on mobile, 8 on desktop */}
              {buySignals.slice(0, 8).map((signal, i) => (
                <div key={signal.symbol} className={i >= 5 ? "hidden sm:block" : ""}>
                  <SignalCard signal={signal} type="buy" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Short Signals */}
        <section>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Short</h2>
              <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
                {sellSignals.length}
              </span>
            </div>
            {sellSignals.length > 5 && (
              <Link
                to="/sell"
                className="flex items-center text-[10px] sm:text-xs text-muted-foreground hover:text-foreground"
              >
                All <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {sellSignals.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No sell signals detected in current market conditions
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {sellSignals.slice(0, 8).map((signal, i) => (
                <div key={signal.symbol} className={i >= 5 ? "hidden sm:block" : ""}>
                  <SignalCard signal={signal} type="sell" />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function MarketDashboard() {
  const { data, isLoading, isError } = useEffectQuery(fetchDashboardData, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <div className="h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Analyzing market signals</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-6 max-w-7xl mx-auto">
        <h1 className="text-base font-medium mb-4">Trading Signals</h1>
        <div className="rounded-lg border border-border bg-muted/30 p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Unable to fetch market data. Check your connection and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <DashboardContent analyses={data} />;
}
