import { cn } from "cn";

import { ScrollEdge } from "@/components/surface/scroll-edge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactUsd, formatSignedPercent, formatSignedUsd } from "@/core/utils/formatters";

import { ROW_STACK, SKELETON_ROW, SUMMARY_SKELETON_KEYS } from "./portfolio-summary.constants";

type Accent = "gain" | "loss" | "warn" | null;

function accentClass(accent: Accent): string {
  if (accent === "gain") return "text-gain";
  if (accent === "loss") return "text-loss";
  if (accent === "warn") return "text-warn";
  return "text-foreground";
}

export function PortfolioSummarySkeleton() {
  return (
    <>
      <div className="flex h-control shrink-0 items-center justify-between">
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
    </>
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

interface SummaryRowData {
  readonly label: string;
  readonly value: string;
  readonly accent: Accent;
}

export function PortfolioSummarySections({ perps, spot, vaults }: PortfolioSummarySectionsProps) {
  const totalEquity =
    perps.accountValue === null ? null : perps.accountValue + (spot?.totalUsdc ?? 0);

  const rows: readonly SummaryRowData[] = [
    {
      label: "PnL",
      value: perps.pnl === 0 ? "$0.00" : formatSignedUsd(perps.pnl),
      accent: perps.pnl === null || perps.pnl === 0 ? null : perps.pnl > 0 ? "gain" : "loss",
    },
    { label: "Volume", value: formatCompactUsd(perps.volume), accent: null },
    {
      label: "Max Drawdown",
      value:
        perps.maxDd === null
          ? "—"
          : perps.maxDd === 0
            ? "0.00%"
            : formatSignedPercent(perps.maxDd * 100),
      accent: perps.maxDd !== null && perps.maxDd < 0 ? "loss" : null,
    },
    { label: "Total Equity", value: formatCompactUsd(totalEquity), accent: null },
    { label: "Trading Equity", value: formatCompactUsd(perps.accountValue), accent: null },
    {
      label: "Vault Equity",
      value: formatCompactUsd(vaults === null ? null : vaults.totalEquity),
      accent: null,
    },
  ];

  return (
    <div className={cn("overflow-y-auto flex-1", ROW_STACK)}>
      {/* one scroll edge per view — Apple HIG scroll views */}
      <ScrollEdge />
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between">
          <span className="type-data font-medium text-muted-foreground tracking-wide">
            {row.label}
          </span>
          <span className={cn("type-data tabular-nums font-medium", accentClass(row.accent))}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
