import { formatPrice } from "@/core/utils/formatters";
import type { ColumnDef, CategoryTab } from "./trade-dropdown";

const NUMERIC_MIN_WIDTH = "4.5rem";

const COLUMN_CONFIG: Record<string, ColumnDef[]> = {
  perp: [
    { id: "symbol", label: "Symbol", align: "left", fr: 2.2, render: (i) => i.displaySymbol },
    {
      id: "price",
      label: "Last Price",
      align: "right",
      fr: 1,
      render: (i) => formatPrice(Number(i.markPx), i.pxDecimals),
    },
    { id: "change", label: "24h Change", align: "right", fr: 1, render: (i) => i.changeFormatted },
    {
      id: "funding",
      label: "8h Funding",
      align: "right",
      fr: 1,
      render: (i) => i.fundingFormatted,
    },
    { id: "volume", label: "Volume", align: "right", fr: 1, render: (i) => i.volumeFormatted },
    { id: "oi", label: "Open Interest", align: "right", fr: 1, render: (i) => i.oiFormatted },
  ],
  spot: [
    { id: "symbol", label: "Symbol", align: "left", fr: 2.2, render: (i) => i.displaySymbol },
    {
      id: "price",
      label: "Last Price",
      align: "right",
      fr: 1,
      render: (i) => formatPrice(Number(i.markPx), i.pxDecimals),
    },
    { id: "change", label: "24h Change", align: "right", fr: 1, render: (i) => i.changeFormatted },
    { id: "volume", label: "Volume", align: "right", fr: 1, render: (i) => i.volumeFormatted },
    {
      id: "marketCap",
      label: "Market Cap",
      align: "right",
      fr: 1,
      render: (i) => i.marketCapFormatted,
    },
  ],
};

export function getColumns(category: CategoryTab): ColumnDef[] {
  return category === "spot" ? COLUMN_CONFIG.spot : COLUMN_CONFIG.perp;
}

export function gridTemplate(cols: ColumnDef[]): string {
  return cols
    .map((c) => `minmax(${c.align === "left" ? "0" : NUMERIC_MIN_WIDTH}, ${c.fr}fr)`)
    .join(" ");
}
