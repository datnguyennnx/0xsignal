import { memo, useMemo } from "react";
import { cn } from "cn";
import {
  computeLiveCells,
  formatMarketCell,
  type LiveCells,
} from "@/features/trade/lib/format-trade-rows";
import { useAssetCtx, useMidPrice } from "@/stores/use-market-data-store";
import { gridTemplate } from "../utils/trade-dropdown-columns";
import type { ColumnDef } from "../utils/trade-dropdown-columns";
import type { MarketRowData } from "../lib/market-row-data";

const ROW_GRID = "grid min-w-0 gap-1 px-2";

function liveText(live: LiveCells, field: ColumnDef["id"]): string | null {
  switch (field) {
    case "price":
      return live.price;
    case "change":
      return live.change;
    case "funding":
      return live.funding;
    case "volume":
      return live.volume;
    case "oi":
      return live.openInterest;
    case "symbol":
    case "marketCap":
      return null;
  }
  return null;
}

function cellText(row: MarketRowData, col: ColumnDef, version: number, live: LiveCells): string {
  return liveText(live, col.id) ?? formatMarketCell(row, col.id, version);
}

function signClass(value: string): string {
  if (value === "--" || value === "—") return "text-muted-foreground";
  return value.startsWith("-") ? "text-loss" : "text-gain";
}

function MarketCell({ row }: { readonly row: MarketRowData }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="truncate font-medium">{row.displaySymbol}</span>
      {row.marketType === "perp" && row.maxLeverage > 0 ? (
        <span className="shrink-0 rounded-control bg-muted/60 px-1 type-label text-muted-foreground">
          {row.maxLeverage}x
        </span>
      ) : null}
      {row.dexPrefix === null ? null : (
        <span className="shrink-0 type-label text-muted-foreground">{row.dexPrefix}</span>
      )}
    </span>
  );
}

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
  const streamKey = row.marketType === "perp" ? row.midKey : "";
  const ctx = useAssetCtx(streamKey);
  const mid = useMidPrice(streamKey);
  const live = useMemo(() => computeLiveCells({ row, ctx, midPx: mid }), [row, ctx, mid]);

  return (
    <div className={cn(ROW_GRID, "py-1")} style={{ gridTemplateColumns: gridTemplate(columns) }}>
      {columns.map((col) => (
        <div
          key={col.id}
          className={cn("flex items-center min-w-0", col.align === "right" && "justify-end")}
        >
          {col.id === "symbol" ? (
            <MarketCell row={row} />
          ) : (
            <span
              className={cn(
                "type-body tabular-nums truncate min-w-0",
                col.align === "right" && "text-right",
                col.id === "change" && signClass(cellText(row, col, version, live)),
                col.id === "funding" && signClass(cellText(row, col, version, live)),
                col.id === "volume" && "text-muted-foreground",
                col.id === "oi" && "text-muted-foreground type-label",
                col.id === "marketCap" && "text-muted-foreground type-label",
              )}
            >
              {cellText(row, col, version, live)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});
