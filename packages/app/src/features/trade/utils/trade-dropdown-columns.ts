import type { CategoryTab } from "./trade-dropdown";

type ColumnId = "symbol" | "price" | "change" | "funding" | "volume" | "oi" | "marketCap";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  align: "left" | "right";
  /** Fraction of available space (relative to other columns). */
  fr: number;
}

const NUMERIC_MIN_WIDTH = "4.5rem";

const COLUMN_CONFIG: Record<string, ColumnDef[]> = {
  perp: [
    { id: "symbol", label: "Symbol", align: "left", fr: 2.2 },
    { id: "price", label: "Last Price", align: "right", fr: 1 },
    { id: "change", label: "24h Change", align: "right", fr: 1 },
    { id: "funding", label: "8h Funding", align: "right", fr: 1 },
    { id: "volume", label: "Volume", align: "right", fr: 1 },
    { id: "oi", label: "Open Interest", align: "right", fr: 1 },
  ],
  spot: [
    { id: "symbol", label: "Symbol", align: "left", fr: 2.2 },
    { id: "price", label: "Last Price", align: "right", fr: 1 },
    { id: "change", label: "24h Change", align: "right", fr: 1 },
    { id: "volume", label: "Volume", align: "right", fr: 1 },
    { id: "marketCap", label: "Market Cap", align: "right", fr: 1 },
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
