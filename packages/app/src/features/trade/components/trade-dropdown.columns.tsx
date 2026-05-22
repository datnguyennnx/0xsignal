import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/core/utils/cn";
import { gridTemplate, HeaderCell } from "./trade-dropdown.columns.helpers";
import type { ColumnDef, FormattedTrade } from "./trade-dropdown.types";

// ── Header row ──────────────────────────────────────────────────────────────

export const MarketHeader = memo(function MarketHeader({
  columns,
  sortBy,
  sortDesc,
  onSort,
}: {
  columns: ColumnDef[];
  sortBy: "name" | "change";
  sortDesc: boolean;
  onSort: (field: "name" | "change") => void;
}) {
  return (
    <div
      className="grid min-w-0 gap-[clamp(0.25rem,0.5vw,0.5rem)] px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider"
      style={{ gridTemplateColumns: gridTemplate(columns) }}
    >
      {columns.map((col) => (
        <HeaderCell key={col.id} col={col} sortBy={sortBy} sortDesc={sortDesc} onSort={onSort} />
      ))}
    </div>
  );
});

// ── Data row ────────────────────────────────────────────────────────────────

export const MarketRow = memo(function MarketRow({
  item,
  columns,
}: {
  item: FormattedTrade;
  columns: ColumnDef[];
}) {
  return (
    <div
      className="grid min-w-0 gap-[clamp(0.25rem,0.5vw,0.5rem)] px-3 py-2.5"
      style={{ gridTemplateColumns: gridTemplate(columns) }}
    >
      {columns.map((col) => (
        <div
          key={col.id}
          className={cn("flex items-center min-w-0", col.align === "right" && "justify-end")}
        >
          <span
            className={cn(
              "font-mono text-sm tabular-nums truncate",
              col.align === "right" && "text-right",
              col.id === "symbol" && "font-medium",
              col.id === "change" && (item.changeValue >= 0 ? "text-gain" : "text-loss"),
              col.id === "funding" && (Number(item.funding) >= 0 ? "text-gain" : "text-loss"),
              col.id === "volume" && "text-muted-foreground",
              col.id === "oi" && "text-muted-foreground text-xs",
              col.id === "marketCap" && "text-muted-foreground text-xs"
            )}
          >
            {col.render(item)}
          </span>
        </div>
      ))}
    </div>
  );
});

// ── Skeleton row ────────────────────────────────────────────────────────────

export const MarketRowSkeleton = memo(function MarketRowSkeleton({
  columns,
}: {
  columns: ColumnDef[];
}) {
  return (
    <div
      className="grid min-w-0 gap-[clamp(0.25rem,0.5vw,0.5rem)] px-3 py-2.5"
      style={{ gridTemplateColumns: gridTemplate(columns) }}
    >
      {columns.map((col) => (
        <div
          key={col.id}
          className={cn("flex items-center", col.align === "right" && "justify-end")}
        >
          <Skeleton className="h-4 w-full max-w-24" />
        </div>
      ))}
    </div>
  );
});
