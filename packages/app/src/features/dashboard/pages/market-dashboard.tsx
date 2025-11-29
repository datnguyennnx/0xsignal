/**
 * Market Dashboard - Minimalist quant-focused design
 * High signal density, reduced cognitive load
 */

import type { AssetAnalysis } from "@0xsignal/shared";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cachedTopAnalysis } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { SignalCard } from "@/features/dashboard/components/signal-card";
import { useMemoizedAllSignals } from "@/features/dashboard/hooks/use-memoized-calc";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CryptoIcon } from "@/components/crypto-icon";
import { MiniSparkline } from "@/features/dashboard/components/mini-sparkline";

const fetchDashboardData = () => cachedTopAnalysis(100);

function DashboardContent({ analyses }: { analyses: AssetAnalysis[] }) {
  const { buySignals, sellSignals, holdSignals, longEntries, shortEntries } =
    useMemoizedAllSignals(analyses);

  // Combine and limit to 3 total trade setups
  const tradeSetups = [...longEntries, ...shortEntries].slice(0, 3);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-6xl mx-auto">
      {/* Header - Minimal */}
      <header className="mb-6">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Signals</h1>
      </header>

      {/* Trade Setups - Max 3 cards with sparklines */}
      {tradeSetups.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-medium">Trade Setups</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {longEntries.length + shortEntries.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {tradeSetups.map((asset) => (
              <SetupCard key={asset.symbol} asset={asset} />
            ))}
          </div>
        </section>
      )}

      {/* Hold - Inline compact with clickable overflow */}
      {holdSignals.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground">Hold ({holdSignals.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {holdSignals.slice(0, 15).map((s) => (
              <HoldChip key={s.symbol} asset={s} />
            ))}
            {holdSignals.length > 15 && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-7 px-2.5 rounded-full text-[10px]"
              >
                <Link to="/hold">+{holdSignals.length - 15}</Link>
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Long & Short - 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Long */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Long</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {buySignals.length}
              </span>
            </div>
            {buySignals.length > 8 && (
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link to="/buy">
                  All <ChevronRight className="w-3 h-3" />
                </Link>
              </Button>
            )}
          </div>
          {buySignals.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6">No long signals</p>
          ) : (
            <div className="space-y-2">
              {buySignals.slice(0, 8).map((s) => (
                <SignalCard key={s.symbol} signal={s} type="buy" />
              ))}
            </div>
          )}
        </section>

        {/* Short */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Short</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {sellSignals.length}
              </span>
            </div>
            {sellSignals.length > 8 && (
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link to="/sell">
                  All <ChevronRight className="w-3 h-3" />
                </Link>
              </Button>
            )}
          </div>
          {sellSignals.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6">No short signals</p>
          ) : (
            <div className="space-y-2">
              {sellSignals.slice(0, 8).map((s) => (
                <SignalCard key={s.symbol} signal={s} type="sell" />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Setup card with sparkline chart
function SetupCard({ asset }: { asset: AssetAnalysis }) {
  const entry = asset.entrySignal;
  const isLong = entry.direction === "LONG";
  const price = asset.price?.price || 0;
  const change = asset.price?.change24h || 0;
  const changeAbs = Math.abs((change * price) / 100);
  const isPositive = change >= 0;

  // Format price based on value
  const formatPrice = (p: number) => {
    if (p < 0.0001) return p.toFixed(8);
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    if (p < 100) return p.toFixed(2);
    return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Card className="py-0 shadow-none hover:shadow-sm transition-shadow">
      <Link to={`/asset/${asset.symbol.toLowerCase()}`} className="block">
        <CardContent className="p-3">
          {/* Row 1: Symbol + Direction */}
          <div className="flex items-center gap-2 mb-2">
            <CryptoIcon symbol={asset.symbol} size={18} className="shrink-0" />
            <span className="font-mono text-sm font-semibold">{asset.symbol.toUpperCase()}</span>
            <span className="text-[10px] text-muted-foreground">
              {entry.direction} · {entry.strength.replace("_", " ")}
            </span>
          </div>

          {/* Row 2: Price + Arrow */}
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span
              className={cn(
                "text-xl font-semibold tabular-nums",
                isPositive ? "text-gain" : "text-loss"
              )}
            >
              {formatPrice(price)}
            </span>
            <span className={cn("text-sm", isPositive ? "text-gain" : "text-loss")}>
              {isPositive ? "↑" : "↓"}
            </span>
          </div>

          {/* Row 3: Change */}
          <div className={cn("text-xs tabular-nums mb-2", isPositive ? "text-gain" : "text-loss")}>
            {isPositive ? "+" : "-"}
            {changeAbs.toFixed(4)} ({isPositive ? "+" : ""}
            {change.toFixed(2)}%)
          </div>

          {/* Row 4: Sparkline Chart */}
          <MiniSparkline symbol={asset.symbol} isPositive={isPositive} className="mb-2" />

          {/* Row 5: Metrics */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/50">
            <div className="flex items-center gap-3">
              <span>
                <span className="tabular-nums">{entry.confidence}%</span> conf
              </span>
              <span>
                <span className="tabular-nums">{asset.riskScore}</span> risk
              </span>
            </div>
            <span className="tabular-nums">R:R {entry.riskRewardRatio}:1</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

// Hold chip
function HoldChip({ asset }: { asset: AssetAnalysis }) {
  const change = asset.price?.change24h || 0;
  return (
    <Button variant="outline" size="sm" asChild className="h-7 px-2.5 rounded-full">
      <Link to={`/asset/${asset.symbol.toLowerCase()}`}>
        <span className="font-mono text-[11px]">{asset.symbol.toUpperCase()}</span>
        <span className={cn("text-[10px] tabular-nums", change >= 0 ? "text-gain" : "text-loss")}>
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
    <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-6xl mx-auto">
      <Skeleton className="h-6 w-20 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
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
  );
}

export function MarketDashboard() {
  const { data, isLoading, isError } = useEffectQuery(fetchDashboardData, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <Card className="py-0">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">Unable to load data.</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DashboardContent analyses={data} />;
}
