/**
 * Market Dashboard - Minimalist quant-focused design
 * High signal density, reduced cognitive load
 * Mobile: single column, Desktop: 2 columns
 */

import type { AssetAnalysis } from "@0xsignal/shared";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cachedTopAnalysis } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { SignalCard } from "@/features/dashboard/components/signal-card";
import { useMemoizedAllSignals } from "@/features/dashboard/hooks/use-memoized-calc";
import { cn } from "@/core/utils/cn";

const fetchDashboardData = () => cachedTopAnalysis(100);

function DashboardContent({ analyses }: { analyses: AssetAnalysis[] }) {
  const { buySignals, sellSignals, holdSignals, longEntries, shortEntries } =
    useMemoizedAllSignals(analyses);

  // Stats
  const totalActive = buySignals.length + sellSignals.length;
  const strongCount =
    buySignals.filter((s) => s.overallSignal === "STRONG_BUY").length +
    sellSignals.filter((s) => s.overallSignal === "STRONG_SELL").length;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-6xl mx-auto">
      {/* Header - Compact */}
      <header className="flex items-baseline justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-base sm:text-lg font-medium">Signals</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {totalActive} active · {strongCount} strong
          </p>
        </div>
        <div className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
          <span className="text-gain">{buySignals.length} long</span>
          <span className="mx-1.5">·</span>
          <span className="text-loss">{sellSignals.length} short</span>
        </div>
      </header>

      {/* Trade Setups - Only show if there are optimal entries */}
      {(longEntries.length > 0 || shortEntries.length > 0) && (
        <section className="mb-6 pb-6 border-b border-border/30">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-medium">Trade Setups</span>
            {longEntries.length > 0 && (
              <span className="text-[10px] text-gain tabular-nums">{longEntries.length} long</span>
            )}
            {shortEntries.length > 0 && (
              <span className="text-[10px] text-loss tabular-nums">
                {shortEntries.length} short
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[...longEntries.slice(0, 3), ...shortEntries.slice(0, 3)].map((asset) => (
              <SetupCard key={asset.symbol} asset={asset} />
            ))}
          </div>
        </section>
      )}

      {/* Hold - Inline compact */}
      {holdSignals.length > 0 && (
        <section className="mb-6 pb-4 border-b border-border/30">
          <div className="flex items-center gap-2 mb-2 text-[10px] text-muted-foreground">
            <span>Hold ({holdSignals.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {holdSignals.slice(0, 15).map((s) => (
              <HoldChip key={s.symbol} asset={s} />
            ))}
            {holdSignals.length > 15 && (
              <span className="text-[10px] text-muted-foreground px-1">
                +{holdSignals.length - 15}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Long & Short - 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Long */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Long</h2>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {buySignals.length}
              </span>
            </div>
            {buySignals.length > 8 && (
              <Link
                to="/buy"
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center"
              >
                All <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          {buySignals.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No long signals</p>
          ) : (
            <div className="space-y-1">
              {buySignals.slice(0, 8).map((s) => (
                <SignalCard key={s.symbol} signal={s} type="buy" />
              ))}
            </div>
          )}
        </section>

        {/* Short */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Short</h2>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {sellSignals.length}
              </span>
            </div>
            {sellSignals.length > 8 && (
              <Link
                to="/sell"
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center"
              >
                All <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          {sellSignals.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No short signals</p>
          ) : (
            <div className="space-y-1">
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

// Compact setup card
function SetupCard({ asset }: { asset: AssetAnalysis }) {
  const entry = asset.entrySignal;
  const isLong = entry.direction === "LONG";
  const change = asset.price?.change24h || 0;

  return (
    <Link
      to={`/asset/${asset.symbol.toLowerCase()}`}
      className="block rounded border border-border/50 p-3 hover:border-foreground/20 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-sm font-medium">{asset.symbol.toUpperCase()}</span>
        <span className={cn("text-xs font-medium", isLong ? "text-gain" : "text-loss")}>
          {entry.direction} · {entry.strength.replace("_", " ")}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className={cn("tabular-nums", change >= 0 ? "text-gain" : "text-loss")}>
          {change >= 0 ? "+" : ""}
          {change.toFixed(1)}%
        </span>
        <span>
          Conf {entry.confidence}% · Risk {asset.riskScore}
        </span>
      </div>
    </Link>
  );
}

// Minimal hold chip
function HoldChip({ asset }: { asset: AssetAnalysis }) {
  const change = asset.price?.change24h || 0;
  return (
    <Link
      to={`/asset/${asset.symbol.toLowerCase()}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border/30 hover:border-foreground/20 text-[10px]"
    >
      <span className="font-mono">{asset.symbol.toUpperCase()}</span>
      <span className={cn("tabular-nums", change >= 0 ? "text-gain" : "text-loss")}>
        {change >= 0 ? "+" : ""}
        {change.toFixed(1)}%
      </span>
    </Link>
  );
}

export function MarketDashboard() {
  const { data, isLoading, isError } = useEffectQuery(fetchDashboardData, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">Loading signals</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <div className="rounded border border-border/50 p-6">
          <p className="text-sm text-muted-foreground mb-4">Unable to load data.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <DashboardContent analyses={data} />;
}
