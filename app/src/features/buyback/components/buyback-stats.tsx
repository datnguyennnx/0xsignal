// Buyback Stats - pure computation

import type { BuybackOverview } from "@0xsignal/shared";
import { formatCurrency } from "@/core/utils/formatters";
import { cn } from "@/core/utils/cn";

interface BuybackStatsProps {
  readonly overview: BuybackOverview;
}

export function BuybackStats({ overview }: BuybackStatsProps) {
  const signals = overview.topBuybackProtocols;
  const highYieldCount = signals.filter((s) => s.annualizedBuybackRate >= 15).length;
  const totalMcap = signals.reduce((sum, s) => sum + s.marketCap, 0);
  const avgYield = overview.averageBuybackRate;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <div className="p-3 rounded-lg border border-border/40 sm:p-4">
        <div className="text-xs text-muted-foreground">24h Revenue</div>
        <div className="text-lg font-semibold tabular-nums mt-1 sm:text-xl">
          ${formatCurrency(overview.totalRevenue24h)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">Aggregate protocol fees</div>
      </div>

      <div className="p-3 rounded-lg border border-border/40 sm:p-4">
        <div className="text-xs text-muted-foreground">Avg Yield</div>
        <div
          className={cn(
            "text-lg font-semibold tabular-nums mt-1 sm:text-xl",
            avgYield >= 10 && "text-gain"
          )}
        >
          {avgYield.toFixed(1)}%
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">Annualized buyback rate</div>
      </div>

      <div className="p-3 rounded-lg border border-border/40 sm:p-4">
        <div className="text-xs text-muted-foreground">Protocols</div>
        <div className="text-lg font-semibold tabular-nums mt-1 sm:text-xl">
          {overview.totalProtocols}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          <span className="text-gain">{highYieldCount}</span> with yield ≥15%
        </div>
      </div>

      <div className="p-3 rounded-lg border border-border/40 sm:p-4">
        <div className="text-xs text-muted-foreground">Total MCap</div>
        <div className="text-lg font-semibold tabular-nums mt-1 sm:text-xl">
          ${formatCurrency(totalMcap)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">Combined market cap</div>
      </div>
    </div>
  );
}
