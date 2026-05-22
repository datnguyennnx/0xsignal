import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { formatPrice } from "@/core/utils/formatters";
import type { ColumnDef, CategoryTab } from "./trade-dropdown.types";

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

export function HeaderCell({
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
          "hover:text-foreground transition-colors flex items-center gap-[clamp(0.15rem,0.3vw,0.25rem)] cursor-pointer bg-transparent border-none p-0 w-full whitespace-nowrap",
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
