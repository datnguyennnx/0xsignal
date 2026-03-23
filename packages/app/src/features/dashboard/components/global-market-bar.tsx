/**
 * @overview Global Market Stats Bar
 *
 * Renders high-level crypto market metrics at the top of the dashboard.
 * Displays Total Market Cap (with 24h change), 24h Volume, and BTC/ETH dominance.
 */
import type { GlobalMarketData } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";

const formatCompact = (value: number): string => {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
};

const formatPercent = (value: number): string => {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
};

interface GlobalMarketBarProps {
  data: GlobalMarketData;
  className?: string;
}

export function GlobalMarketBar({ data, className }: GlobalMarketBarProps) {
  return (
    <div className={cn("flex items-center text-xs gap-x-2", className)}>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">MCap</span>
          <span className="font-medium tabular-nums">${formatCompact(data.totalMarketCap)}</span>
          <span
            className={cn("tabular-nums", data.marketCapChange24h >= 0 ? "text-gain" : "text-loss")}
          >
            {formatPercent(data.marketCapChange24h)}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-muted-foreground">Vol</span>
          <span className="font-medium tabular-nums">${formatCompact(data.totalVolume24h)}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">BTC</span>
          <span className="font-medium tabular-nums">{data.btcDominance.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">ETH</span>
          <span className="font-medium tabular-nums">{data.ethDominance.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export function GlobalMarketBarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 sm:px-6 py-3 border-b animate-pulse",
        className
      )}
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded" />
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="h-3 w-6 bg-muted rounded" />
          <div className="h-3 w-10 bg-muted rounded" />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-6 bg-muted rounded" />
          <div className="h-3 w-10 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-6 bg-muted rounded" />
          <div className="h-3 w-10 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
