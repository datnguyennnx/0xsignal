import { cn } from "cn";

import { ScrollEdge } from "@/components/surface/scroll-edge";
import { Surface } from "@/components/surface/surface";
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
      <span className="type-data font-medium text-muted-foreground tracking-wide">{label}</span>
      <span
        className={cn(
          "type-data tabular-nums font-medium",
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
    <Surface tier="content" className={SURFACE}>
      <div className="flex h-control items-center justify-between">
        <Skeleton className="h-3.5 w-12" />
        <Skeleton className="h-5 w-9" />
      </div>
      <div className={cn("flex-1", ROW_STACK)}>
        {SUMMARY_SKELETON_KEYS.map((key) => (
          <div key={key} className={SKELETON_ROW}>
            <Skeleton className="h-[0.6875rem] w-[38%]" />
            <Skeleton className="h-[0.6875rem] w-[28%]" />
          </div>
        ))}
      </div>
    </Surface>
  );
}

export function PortfolioSummaryError() {
  return (
    <Surface tier="content" className={SURFACE}>
      <div className="flex-1 flex items-center justify-center">
        <span className="type-label uppercase tracking-widest text-muted-foreground">
          Unable to load
        </span>
      </div>
    </Surface>
  );
}

interface PortfolioSummarySectionsProps {
  readonly perps: {
    readonly pnl: number | null;
    readonly volume: number | null;
    readonly maxDd: number | null;
    readonly accountValue: number | null;
  };
  readonly spot: { readonly totalUsdc: number } | null;
  readonly vaults: { readonly totalEquity: number } | null;
}

export function PortfolioSummarySections({ perps, spot, vaults }: PortfolioSummarySectionsProps) {
  const totalEquity =
    perps.accountValue === null ? null : perps.accountValue + (spot?.totalUsdc ?? 0);

  return (
    <div className={cn("overflow-y-auto flex-1", ROW_STACK)}>
      {/* one scroll edge per view — Apple HIG scroll views */}
      <ScrollEdge />
      <SummaryRow
        label="PnL"
        value={perps.pnl === 0 ? "$0.00" : formatSignedUsd(perps.pnl)}
        accent={perps.pnl === null || perps.pnl === 0 ? null : perps.pnl > 0 ? "gain" : "loss"}
      />
      <SummaryRow label="Volume" value={formatCompactUsd(perps.volume)} />
      <SummaryRow
        label="Max Drawdown"
        value={
          perps.maxDd === null
            ? "—"
            : perps.maxDd === 0
              ? "0.00%"
              : formatSignedPercent(perps.maxDd * 100)
        }
        accent={perps.maxDd !== null && perps.maxDd < 0 ? "loss" : null}
      />
      <SummaryRow label="Total Equity" value={formatCompactUsd(totalEquity)} />
      <SummaryRow label="Trading Equity" value={formatCompactUsd(perps.accountValue)} />
      <SummaryRow
        label="Vault Equity"
        value={formatCompactUsd(vaults === null ? null : vaults.totalEquity)}
      />
    </div>
  );
}
