import { Effect, Exit, pipe } from "effect";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getTopAnalysis } from "../lib/api";
import { useEffect_ } from "../lib/runtime";
import { cn } from "@/lib/utils";
import { RegimeBadge } from "@/components/RegimeBadge";
import { CrashAlert } from "@/components/CrashAlert";

const fetchDashboardData = () =>
  Effect.gen(function* () {
    return yield* getTopAnalysis(50);
  });

export function MarketDashboard() {
  const exit = useEffect_(fetchDashboardData, []);
  const navigate = useNavigate();

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
        const buySignals = analyses.filter(
          (a: any) =>
            a.strategyAnalysis?.overallSignal === "STRONG_BUY" ||
            a.strategyAnalysis?.overallSignal === "BUY" ||
            a.quantAnalysis?.overallSignal === "STRONG_BUY" ||
            a.quantAnalysis?.overallSignal === "BUY"
        );
        const sellSignals = analyses.filter(
          (a: any) =>
            a.strategyAnalysis?.overallSignal === "STRONG_SELL" ||
            a.strategyAnalysis?.overallSignal === "SELL" ||
            a.quantAnalysis?.overallSignal === "STRONG_SELL" ||
            a.quantAnalysis?.overallSignal === "SELL"
        );

        const crashAlerts = analyses.filter(
          (a: any) => a.strategyAnalysis?.crashSignal?.isCrashing
        );

        const topBuy = buySignals.slice(0, 10);
        const topSell = sellSignals.slice(0, 10);

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
                    {topBuy.map((signal: any) => {
                      const overallSignal =
                        signal.strategyAnalysis?.overallSignal ||
                        signal.quantAnalysis?.overallSignal;
                      const isStrong = overallSignal === "STRONG_BUY";
                      const confidence =
                        signal.strategyAnalysis?.confidence ||
                        signal.quantAnalysis?.confidence ||
                        0;
                      const regime = signal.strategyAnalysis?.strategyResult?.regime;
                      const price = signal.price?.price || 0;
                      const change24h = signal.price?.change24h || 0;
                      const volume24h = signal.price?.volume24h || 0;

                      return (
                        <button
                          key={signal.symbol}
                          onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
                          className={cn(
                            "w-full rounded-lg border p-3 transition-all text-left hover:shadow-md",
                            isStrong
                              ? "bg-green-500/5 border-green-500/50"
                              : "bg-card hover:bg-accent/50"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold uppercase">{signal.symbol}</span>
                              {isStrong && (
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-500 text-white">
                                  STRONG
                                </span>
                              )}
                              {regime && <RegimeBadge regime={regime} />}
                            </div>
                            <span className="text-sm font-bold text-green-500">{confidence}%</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Price</div>
                              <div className="font-medium">${price.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">24h</div>
                              <div
                                className={cn(
                                  "font-medium",
                                  change24h > 0 ? "text-green-500" : "text-red-500"
                                )}
                              >
                                {change24h > 0 ? "+" : ""}
                                {change24h.toFixed(2)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Volume</div>
                              <div className="font-medium">
                                $
                                {volume24h >= 1000000
                                  ? (volume24h / 1000000).toFixed(0) + "M"
                                  : (volume24h / 1000).toFixed(0) + "K"}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
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
                    {topSell.map((signal: any) => {
                      const overallSignal =
                        signal.strategyAnalysis?.overallSignal ||
                        signal.quantAnalysis?.overallSignal;
                      const isStrong = overallSignal === "STRONG_SELL";
                      const confidence =
                        signal.strategyAnalysis?.confidence ||
                        signal.quantAnalysis?.confidence ||
                        0;
                      const regime = signal.strategyAnalysis?.strategyResult?.regime;
                      const price = signal.price?.price || 0;
                      const change24h = signal.price?.change24h || 0;
                      const volume24h = signal.price?.volume24h || 0;

                      return (
                        <button
                          key={signal.symbol}
                          onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
                          className={cn(
                            "w-full rounded-lg border p-3 transition-all text-left hover:shadow-md",
                            isStrong
                              ? "bg-red-500/5 border-red-500/50"
                              : "bg-card hover:bg-accent/50"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold uppercase">{signal.symbol}</span>
                              {isStrong && (
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-500 text-white">
                                  STRONG
                                </span>
                              )}
                              {regime && <RegimeBadge regime={regime} />}
                            </div>
                            <span className="text-sm font-bold text-red-500">{confidence}%</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Price</div>
                              <div className="font-medium">${price.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">24h</div>
                              <div
                                className={cn(
                                  "font-medium",
                                  change24h > 0 ? "text-green-500" : "text-red-500"
                                )}
                              >
                                {change24h > 0 ? "+" : ""}
                                {change24h.toFixed(2)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Volume</div>
                              <div className="font-medium">
                                $
                                {volume24h >= 1000000
                                  ? (volume24h / 1000000).toFixed(0) + "M"
                                  : (volume24h / 1000).toFixed(0) + "K"}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
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
