import { useClearinghouseState } from "../hooks/use-user-data";
import { formatCompactUsd } from "@/core/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/core/utils/cn";

export function UnifiedAccountSummary() {
  const { data: chData, isLoading } = useClearinghouseState();

  const marginSummary = chData?.marginSummary;
  const positions = chData?.assetPositions ?? [];

  const accountValue = marginSummary ? Number(marginSummary.accountValue) : 0;
  const totalNtlPos = marginSummary ? Number(marginSummary.totalNtlPos) : 0;
  const totalMarginUsed = marginSummary ? Number(marginSummary.totalMarginUsed) : 0;
  const totalUnrealizedPnl = positions.reduce(
    (sum, p) => sum + Number(p.position.unrealizedPnl),
    0
  );

  const accountRatio = accountValue > 0 ? (totalMarginUsed / accountValue) * 100 : 0;
  const accountLeverage = accountValue > 0 ? totalNtlPos / accountValue : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-3.5 w-14" />
      </div>
    );
  }

  if (!marginSummary) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-xs text-muted-foreground">Unified Account</span>
        <span className="text-xs text-muted-foreground">N/A</span>
      </div>
    );
  }

  const pnlPos = totalUnrealizedPnl >= 0;
  const pnlClass = pnlPos ? "text-gain" : "text-loss";

  return (
    <div className="flex flex-col gap-[clamp(0.5rem,1vw,1rem)]">
      {/* Title */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Unified Account
        </span>
      </div>

      {/* Portfolio Value */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Portfolio Value</span>
        <span className="text-xs tabular-nums text-foreground">
          {formatCompactUsd(accountValue)}
        </span>
      </div>

      {/* Unrealized PNL */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Unrealized PNL</span>
        <span className={cn("text-xs tabular-nums", pnlClass)}>
          {formatCompactUsd(totalUnrealizedPnl)}
        </span>
      </div>

      {/* Account Ratio */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Account Ratio</span>
        <span className="text-xs tabular-nums text-foreground">{accountRatio.toFixed(2)}%</span>
      </div>

      {/* Account Leverage */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Account Leverage</span>
        <span className="text-xs tabular-nums text-foreground">{accountLeverage.toFixed(2)}x</span>
      </div>
    </div>
  );
}
