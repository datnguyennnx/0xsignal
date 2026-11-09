import { memo } from "react";
import { cn } from "cn";
import { formatMarketCell } from "@/features/trade/lib/format-trade-rows";
import { gridTemplate } from "../utils/trade-dropdown-columns";
import type { ColumnDef } from "../utils/trade-dropdown-columns";
import type { MarketRowData } from "../lib/market-row-data";

const ROW_GRID = "grid min-w-0 gap-1 px-2";

interface MarketRowProps {
  readonly row: MarketRowData;
  readonly columns: ColumnDef[];
  readonly version: number;
}

/**
 * One visible row. `row` and `columns` are stable object references (a snapshot
 * swap replaces `row`, a tab swap replaces `columns`), so `memo` skips a repaint
 * for every row outside the current window.
 */
export const MarketRow = memo(function MarketRow({ row, columns, version }: MarketRowProps) {
  return (
    <div className={cn(ROW_GRID, "py-1")} style={{ gridTemplateColumns: gridTemplate(columns) }}>
      {columns.map((col) => (
        <div
          key={col.id}
          className={cn("flex items-center min-w-0", col.align === "right" && "justify-end")}
        >
          <span
            className={cn(
              "type-body tabular-nums truncate min-w-0",
              col.align === "right" && "text-right",
              col.id === "symbol" && "font-medium",
              col.id === "change" &&
                (row.changePct === null
                  ? "text-muted-foreground"
                  : row.changePct >= 0
                    ? "text-gain"
                    : "text-loss"),
              col.id === "funding" && (row.funding >= 0 ? "text-gain" : "text-loss"),
              col.id === "volume" && "text-muted-foreground",
              col.id === "oi" && "text-muted-foreground type-label",
              col.id === "marketCap" && "text-muted-foreground type-label",
            )}
          >
            {formatMarketCell(row, col.id, version)}
          </span>
        </div>
      ))}
    </div>
  );
});
