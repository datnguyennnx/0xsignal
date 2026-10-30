import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import { gridTemplate } from "../utils/trade-dropdown-columns";
import { HeaderCell } from "./trade-dropdown.columns.helpers";
import type { ColumnDef, FormattedTrade } from "../utils/trade-dropdown";

const ROW_GRID = "grid min-w-0 gap-[clamp(0.25rem,0.5vw,0.5rem)] px-3";

function GridRow({
  columns,
  className,
  children,
}: {
  columns: ColumnDef[];
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(ROW_GRID, className)} style={{ gridTemplateColumns: gridTemplate(columns) }}>
      {children}
    </div>
  );
}

export function MarketHeader({
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
    <GridRow
      columns={columns}
      className="py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider"
    >
      {columns.map((col) => (
        <HeaderCell key={col.id} col={col} sortBy={sortBy} sortDesc={sortDesc} onSort={onSort} />
      ))}
    </GridRow>
  );
}

export function MarketRow({ item, columns }: { item: FormattedTrade; columns: ColumnDef[] }) {
  return (
    <GridRow columns={columns} className="py-2.5">
      {columns.map((col) => (
        <div
          key={col.id}
          className={cn("flex items-center min-w-0", col.align === "right" && "justify-end")}
        >
          <span
            className={cn(
              "text-sm tabular-nums truncate min-w-0",
              col.align === "right" && "text-right",
              col.id === "symbol" && "font-medium",
              col.id === "change" && (item.changeValue >= 0 ? "text-gain" : "text-loss"),
              col.id === "funding" && (Number(item.funding) >= 0 ? "text-gain" : "text-loss"),
              col.id === "volume" && "text-muted-foreground",
              col.id === "oi" && "text-muted-foreground text-xs",
              col.id === "marketCap" && "text-muted-foreground text-xs",
            )}
          >
            {col.render(item)}
          </span>
        </div>
      ))}
    </GridRow>
  );
}

export function MarketRowSkeleton({ columns }: { columns: ColumnDef[] }) {
  return (
    <GridRow columns={columns} className="py-2.5">
      {columns.map((col) => (
        <div
          key={col.id}
          className={cn("flex items-center min-w-0", col.align === "right" && "justify-end")}
        >
          <Skeleton className="h-4 w-full max-w-24" />
        </div>
      ))}
    </GridRow>
  );
}
