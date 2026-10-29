import { cn } from "cn";

import { ScrollEdge } from "@/components/surface/scroll-edge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactUsd, formatSignedPercent, formatSignedUsd } from "@/core/utils/formatters";

import {
  ROW_STACK,
  SKELETON_ROW,
  SUMMARY_SKELETON_KEYS,
  SURFACE,
} from "./portfolio-summary.constants";

interface SummaryRowProps {
  label: string;
  value: string;
  accent?: "gain" | "loss" | "warn" | null;
}

function SummaryRow({ label, value, accent }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[length:var(--text-data)] font-medium text-muted-foreground tracking-wide">
        {label}
      </span>
      <span
        className={cn(
          "text-[length:var(--text-compact)] tabular-nums font-medium",
          accent === "gain" && "text-gain",
          accent === "loss" && "text-loss",
          accent === "warn" && "text-warn",
          !accent && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function PortfolioSummarySkeleton() {
  return (
    <div className={SURFACE}>
      <div className="flex h-7 items-center justify-between">
        <Skeleton className="h-3.5 w-12" />
        <Skeleton className="h-5 w-9" />
      </div>
      <div className={cn("flex-1", ROW_STACK)}>
        {SUMMARY_SKELETON_KEYS.map((key) => (
          <div key={key} className={SKELETON_ROW}>
            <Skeleton className="h-[11px] w-[38%]" />
            <Skeleton className="h-[11px] w-[28%]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortfolioSummaryError() {
  return (
    <div className={SURFACE}>
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Unable to load
        </span>
      </div>
    </div>
  );
}

interface PortfolioSummarySectionsProps {
  readonly perps: {
    readonly pnl: number;
    readonly volume: number;
    readonly maxDd: number | null;
    readonly accountValue: number;
  };
  readonly spot: { readonly totalUsdc: number } | null;
  readonly vaults: { readonly totalEquity: number } | null;
}

export function PortfolioSummarySections({ perps, spot, vaults }: PortfolioSummarySectionsProps) {
  return (
    <div className={cn("overflow-y-auto flex-1", ROW_STACK)}>
      {/* one scroll edge per view — Apple HIG scroll views */}
      <ScrollEdge />
      <SummaryRow
        label="PNL"
        value={perps.pnl === 0 ? "$0.00" : formatSignedUsd(perps.pnl)}
        accent={perps.pnl > 0 ? "gain" : perps.pnl < 0 ? "loss" : null}
      />
      <SummaryRow label="Volume" value={formatCompactUsd(perps.volume)} />
      <SummaryRow
        label="Max Drawdown"
        value={perps.maxDd === null ? "0.00%" : formatSignedPercent(perps.maxDd * 100)}
        accent={perps.maxDd !== null && perps.maxDd < 0 ? "loss" : null}
      />
      <SummaryRow
        label="Total Equity"
        value={formatCompactUsd(perps.accountValue + (spot?.totalUsdc ?? 0))}
      />
      <SummaryRow label="Trading Equity" value={formatCompactUsd(perps.accountValue)} />
      <SummaryRow label="Vault Equity" value={formatCompactUsd(vaults?.totalEquity ?? 0)} />
      <SummaryRow label="Earn Balance" value="$0.00" />
      <SummaryRow label="Staking Account" value="0 HYPE" />
    </div>
  );
}
