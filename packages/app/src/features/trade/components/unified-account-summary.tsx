import { formatCompactUsd, formatSignedPercent, formatSize } from "@/core/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import { useUserBalances } from "../hooks/use-user-balances";

/** Loaded rows stack with this gap; the skeleton uses it so the height matches. */
const STACK = "flex flex-col gap-1";

/** Loaded rows and skeletons share this box, so both resolve to the same height. */
const ROW = "flex items-center justify-between py-1";

const SKELETON_ROW_KEYS = ["value", "pnl", "ratio", "leverage"];

export function UnifiedAccountSummary() {
  const { marginSummary, totalUnrealizedPnl, isChLoading } = useUserBalances();

  const accountValue = marginSummary ? Number(marginSummary.accountValue) : 0;
  const totalNtlPos = marginSummary ? Number(marginSummary.totalNtlPos) : 0;
  const totalMarginUsed = marginSummary ? Number(marginSummary.totalMarginUsed) : 0;

  const accountRatio = accountValue > 0 ? (totalMarginUsed / accountValue) * 100 : 0;
  const accountLeverage = accountValue > 0 ? totalNtlPos / accountValue : 0;

  if (isChLoading) {
    return (
      <div className={STACK}>
        <div className={ROW}>
          <Skeleton className="h-4 w-24" />
        </div>
        {SKELETON_ROW_KEYS.map((key) => (
          <div key={key} className={ROW}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    );
  }

  if (!marginSummary) {
    return (
      <div className="flex items-center justify-between px-3 py-1">
        <span className="type-label text-muted-foreground">Unified Account</span>
        <span className="type-label text-muted-foreground">N/A</span>
      </div>
    );
  }

  const pnlPos = totalUnrealizedPnl >= 0;
  const pnlClass = pnlPos ? "text-gain" : "text-loss";

  return (
    <div className={STACK}>
      <div className={ROW}>
        <span className="type-label font-medium uppercase tracking-wider text-muted-foreground">
          Unified Account
        </span>
      </div>

      <div className={ROW}>
        <span className="type-label text-muted-foreground">Portfolio Value</span>
        <span className="type-data tabular-nums text-foreground">
          {formatCompactUsd(accountValue)}
        </span>
      </div>

      <div className={ROW}>
        <span className="type-label text-muted-foreground">Unrealized PNL</span>
        <span className={cn("type-data tabular-nums", pnlClass)}>
          {formatCompactUsd(totalUnrealizedPnl)}
        </span>
      </div>

      <div className={ROW}>
        <span className="type-label text-muted-foreground">Account Ratio</span>
        <span className="type-data tabular-nums text-foreground">
          {formatSignedPercent(accountRatio)}
        </span>
      </div>

      <div className={ROW}>
        <span className="type-label text-muted-foreground">Account Leverage</span>
        <span className="type-data tabular-nums text-foreground">
          {formatSize(accountLeverage)}x
        </span>
      </div>
    </div>
  );
}
