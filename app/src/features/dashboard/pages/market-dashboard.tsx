import { Exit, pipe } from "effect";
import type { AssetAnalysis } from "@0xsignal/shared";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getCachedTopAnalysis } from "@/core/api/cached-queries";
import { useEffect_ } from "@/core/runtime/use-effect";
import { SignalCard } from "@/features/dashboard/components/signal-card";
import { HoldCard } from "@/features/dashboard/components/hold-card";
import { useMemoizedSignals } from "@/features/dashboard/hooks/use-memoized-calc";

const fetchDashboardData = () => getCachedTopAnalysis(100);

// Extracted component to properly use hooks
function DashboardContent({ analyses }: { analyses: AssetAnalysis[] }) {
  const { buySignals, sellSignals, holdSignals } = useMemoizedSignals(analyses);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-baseline gap-4 mb-6">
        <h1 className="text-lg font-medium">Market Signals</h1>
        <div className="text-xs text-muted-foreground tabular-nums">
          {buySignals.length} long · {sellSignals.length} short · {holdSignals.length} hold
        </div>
      </div>

      {/* Hold Section - Minimal inline list at top */}
      {holdSignals.length > 0 && (
        <div className="pb-6 mb-6 border-b border-border/20">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              to="/hold"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground"
            >
              Hold ({holdSignals.length})
            </Link>
            {holdSignals.slice(0, 30).map((signal) => (
              <HoldCard key={signal.symbol} signal={signal} />
            ))}
            {holdSignals.length > 30 && (
              <Link to="/hold" className="text-xs text-muted-foreground hover:text-foreground">
                +{holdSignals.length - 30} more
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Long & Short - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Long Signals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Long</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {buySignals.length}
              </span>
            </div>
            {buySignals.length > 10 && (
              <Link to="/buy">
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  See All
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>

          {buySignals.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No signals</div>
          ) : (
            <div className="space-y-2">
              {buySignals.slice(0, 10).map((signal) => (
                <SignalCard key={signal.symbol} signal={signal} type="buy" />
              ))}
            </div>
          )}
        </div>

        {/* Short Signals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Short</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {sellSignals.length}
              </span>
            </div>
            {sellSignals.length > 10 && (
              <Link to="/sell">
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  See All
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>

          {sellSignals.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No signals</div>
          ) : (
            <div className="space-y-2">
              {sellSignals.slice(0, 10).map((signal) => (
                <SignalCard key={signal.symbol} signal={signal} type="sell" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MarketDashboard() {
  const exit = useEffect_(fetchDashboardData, []);

  if (!exit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return pipe(
    exit,
    Exit.match({
      onFailure: () => (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-lg font-medium mb-6">Market Signals</h1>
          <div className="text-sm text-loss">Unable to load data</div>
        </div>
      ),
      onSuccess: (analyses) => <DashboardContent analyses={analyses} />,
    })
  );
}
