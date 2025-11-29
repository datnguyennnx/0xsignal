/**
 * Buyback Stats - Pure computation with Card components
 */

import type { BuybackOverview } from "@0xsignal/shared";
import { formatCurrency } from "@/core/utils/formatters";
import { cn } from "@/core/utils/cn";
import { Card, CardContent } from "@/components/ui/card";

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
      <Card className="py-0 shadow-none">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">24h Revenue</div>
          <div className="text-lg font-semibold tabular-nums mt-1.5 sm:text-xl">
            ${formatCurrency(overview.totalRevenue24h)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Aggregate protocol fees</div>
        </CardContent>
      </Card>

      <Card className="py-0 shadow-none">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Avg Yield</div>
          <div
            className={cn(
              "text-lg font-semibold tabular-nums mt-1.5 sm:text-xl",
              avgYield >= 10 && "text-gain"
            )}
          >
            {avgYield.toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Annualized buyback rate</div>
        </CardContent>
      </Card>

      <Card className="py-0 shadow-none">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Protocols</div>
          <div className="text-lg font-semibold tabular-nums mt-1.5 sm:text-xl">
            {overview.totalProtocols}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            <span className="text-gain font-medium">{highYieldCount}</span> with yield ≥15%
          </div>
        </CardContent>
      </Card>

      <Card className="py-0 shadow-none">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total MCap</div>
          <div className="text-lg font-semibold tabular-nums mt-1.5 sm:text-xl">
            ${formatCurrency(totalMcap)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Combined market cap</div>
        </CardContent>
      </Card>
    </div>
  );
}
