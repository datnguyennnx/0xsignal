import type { ReactNode } from "react";
import { cn } from "cn";
import { gridTemplate } from "../utils/trade-dropdown-columns";
import { HeaderCell } from "./trade-dropdown.columns.helpers";
import type { ColumnDef } from "../utils/trade-dropdown-columns";

const ROW_GRID = "grid min-w-0 gap-1 px-2";

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
      className="py-1 type-label font-medium text-muted-foreground uppercase tracking-wider"
    >
      {columns.map((col) => (
        <HeaderCell key={col.id} col={col} sortBy={sortBy} sortDesc={sortDesc} onSort={onSort} />
      ))}
    </GridRow>
  );
}
