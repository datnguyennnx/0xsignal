import { memo, useMemo } from "react";
import type { BuybackOverview } from "@0xsignal/shared";

interface BuybackStatsProps {
  readonly overview: BuybackOverview;
}

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export const BuybackStats = memo(function BuybackStats({ overview }: BuybackStatsProps) {
  const stats = useMemo(() => {
    const signals = overview.topBuybackProtocols;
    const highYieldCount = signals.filter((s) => s.annualizedBuybackRate >= 15).length;
    const totalMcap = signals.reduce((sum, s) => sum + s.marketCap, 0);

    return { highYieldCount, totalMcap };
  }, [overview.topBuybackProtocols]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {/* Revenue 24h */}
      <div className="p-3 rounded-lg border border-border/40 sm:p-4">
        <div className="text-xs text-muted-foreground">Revenue 24h</div>
        <div className="text-lg font-semibold tabular-nums mt-1 sm:text-xl">
          {formatCurrency(overview.totalRevenue24h)}
        </div>
      </div>

      {/* Avg Yield */}
      <div className="p-3 rounded-lg border border-border/40 sm:p-4">
        <div className="text-xs text-muted-foreground">Avg Yield</div>
        <div className="text-lg font-semibold tabular-nums mt-1 sm:text-xl">
          {overview.averageBuybackRate.toFixed(1)}%
        </div>
      </div>

      {/* Protocols */}
      <div className="p-3 rounded-lg border border-border/40 sm:p-4">
        <div className="text-xs text-muted-foreground">Protocols</div>
        <div className="text-lg font-semibold tabular-nums mt-1 sm:text-xl">
          {overview.totalProtocols}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {stats.highYieldCount} high yield
        </div>
      </div>

      {/* Total MCap */}
      <div className="p-3 rounded-lg border border-border/40 sm:p-4">
        <div className="text-xs text-muted-foreground">Total MCap</div>
        <div className="text-lg font-semibold tabular-nums mt-1 sm:text-xl">
          {formatCurrency(stats.totalMcap)}
        </div>
      </div>
    </div>
  );
});
