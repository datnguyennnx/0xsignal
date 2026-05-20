import { memo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/core/utils/formatters";
import type { ColumnDef, FormattedTrade, CategoryTab } from "./trade-dropdown.types";

// ── Column config ───────────────────────────────────────────────────────────

const COLUMN_CONFIG: Record<string, ColumnDef[]> = {
  perp: [
    { id: "symbol", label: "Symbol", align: "left", fr: 3, render: (i) => i.displaySymbol },
    {
      id: "price",
      label: "Last Price",
      align: "right",
      fr: 1.5,
      render: (i) => formatPrice(Number(i.markPx), i.pxDecimals),
    },
    {
      id: "change",
      label: "24h Change",
      align: "right",
      fr: 1.2,
      render: (i) => i.changeFormatted,
    },
    {
      id: "funding",
      label: "8h Funding",
      align: "right",
      fr: 1.2,
      render: (i) => i.fundingFormatted,
    },
    { id: "volume", label: "Volume", align: "right", fr: 1.1, render: (i) => i.volumeFormatted },
    { id: "oi", label: "Open Interest", align: "right", fr: 1, render: (i) => i.oiFormatted },
  ],
  spot: [
    { id: "symbol", label: "Symbol", align: "left", fr: 3, render: (i) => i.displaySymbol },
    {
      id: "price",
      label: "Last Price",
      align: "right",
      fr: 1.5,
      render: (i) => formatPrice(Number(i.markPx), i.pxDecimals),
    },
    {
      id: "change",
      label: "24h Change",
      align: "right",
      fr: 1.2,
      render: (i) => i.changeFormatted,
    },
    { id: "volume", label: "Volume", align: "right", fr: 1.1, render: (i) => i.volumeFormatted },
    {
      id: "marketCap",
      label: "Market Cap",
      align: "right",
      fr: 1.2,
      render: (i) => i.marketCapFormatted,
    },
  ],
};

export function getColumns(category: CategoryTab): ColumnDef[] {
  return category === "spot" ? COLUMN_CONFIG.spot : COLUMN_CONFIG.perp;
}

export function gridTemplate(cols: ColumnDef[]): string {
  return cols.map((c) => `minmax(0,${c.fr}fr)`).join(" ");
}

// ── Sort icon ───────────────────────────────────────────────────────────────

const SortIcon = ({
  sortBy,
  sortField,
  sortDesc,
}: {
  sortBy: "name" | "change";
  sortField: "name" | "change";
  sortDesc: boolean;
}) => {
  const isActive = sortBy === sortField;
  if (sortField === "change" && isActive) {
    return sortDesc ? (
      <ArrowDown className="w-3 h-3 text-gain" />
    ) : (
      <ArrowUp className="w-3 h-3 text-loss" />
    );
  }
  if (isActive) {
    return sortDesc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />;
  }
  return <ArrowUpDown className="w-3 h-3 opacity-50" />;
};

// ── Header cell ─────────────────────────────────────────────────────────────

function HeaderCell({
  col,
  sortBy,
  sortDesc,
  onSort,
}: {
  col: ColumnDef;
  sortBy: "name" | "change";
  sortDesc: boolean;
  onSort: (field: "name" | "change") => void;
}) {
  const sortField = col.id === "change" ? "change" : col.id === "symbol" ? "name" : undefined;

  if (sortField) {
    return (
      <button
        type="button"
        onClick={() => onSort(sortField)}
        className={cn(
          "hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 w-full whitespace-nowrap",
          col.align === "right" && "justify-end"
        )}
      >
        <span className="truncate">{col.label}</span>
        <SortIcon sortBy={sortBy} sortField={sortField} sortDesc={sortDesc} />
      </button>
    );
  }

  return (
    <span className={cn("w-full whitespace-nowrap", col.align === "right" && "text-right block")}>
      {col.label}
    </span>
  );
}

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
      className="grid min-w-0 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30"
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
      className="grid min-w-0 gap-2 px-3 py-2.5"
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
      className="grid min-w-0 gap-2 px-3 py-2.5"
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
