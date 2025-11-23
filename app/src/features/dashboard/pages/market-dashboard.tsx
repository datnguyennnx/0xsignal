import { Exit, pipe } from "effect";
import { Button } from "@/ui/button";
import { RefreshCw, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getCachedTopAnalysis } from "@/core/api/cached-queries";
import { useEffect_ } from "@/core/runtime/use-effect";
import { CrashAlert } from "@/features/asset-detail/components/crash-alert";
import { SignalCard } from "@/features/dashboard/components/signal-card";
import { useMemoizedSignals } from "@/features/dashboard/hooks/use-memoized-calc";

const fetchDashboardData = () => getCachedTopAnalysis(50);

export function MarketDashboard() {
  const exit = useEffect_(fetchDashboardData, []);

  if (!exit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return pipe(
    exit,
    Exit.match({
      onFailure: () => (
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Trading Signals</h1>
            <Button onClick={() => window.location.reload()} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <div className="rounded-lg border border-red-500/50 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-red-500">Unable to load data. Please refresh.</p>
          </div>
        </div>
      ),
      onSuccess: (analyses) => {
        const { buySignals, sellSignals, crashAlerts, topBuy, topSell } =
          useMemoizedSignals(analyses);

        return (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Trading Signals</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {buySignals.length} buy • {sellSignals.length} sell
                  {crashAlerts.length > 0 && ` • ${crashAlerts.length} crash alert`}
                </p>
              </div>
              <Button onClick={() => window.location.reload()} size="sm" variant="outline">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {crashAlerts.length > 0 && (
              <div className="space-y-2">
                {crashAlerts.slice(0, 3).map((alert: any) => (
                  <CrashAlert
                    key={alert.symbol}
                    isCrashing={alert.strategyAnalysis.crashSignal.isCrashing}
                    severity={alert.strategyAnalysis.crashSignal.severity}
                    recommendation={`${alert.symbol.toUpperCase()}: ${alert.strategyAnalysis.crashSignal.recommendation}`}
                  />
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b-2 border-green-500">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <h2 className="font-bold">Buy Signals</h2>
                    <span className="text-sm text-muted-foreground">({buySignals.length})</span>
                  </div>
                  {buySignals.length > 5 && (
                    <Link to="/buy">
                      <Button size="sm" variant="ghost" className="text-xs">
                        View All <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>

                {topBuy.length === 0 ? (
                  <div className="rounded-lg border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">No buy signals</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topBuy.map((signal) => (
                      <SignalCard key={signal.symbol} signal={signal} type="buy" />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b-2 border-red-500">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <h2 className="font-bold">Sell Signals</h2>
                    <span className="text-sm text-muted-foreground">({sellSignals.length})</span>
                  </div>
                  {sellSignals.length > 5 && (
                    <Link to="/sell">
                      <Button size="sm" variant="ghost" className="text-xs">
                        View All <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>

                {topSell.length === 0 ? (
                  <div className="rounded-lg border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">No sell signals</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topSell.map((signal) => (
                      <SignalCard key={signal.symbol} signal={signal} type="sell" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      },
    })
  );
}
