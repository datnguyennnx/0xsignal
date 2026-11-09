import {
  formatCompactUsd,
  formatFundingPercent,
  formatPrice,
  formatSignedPercent,
  formatSize,
} from "@/core/utils/formatters";
import type { MarketRowData } from "./market-row-data";

export type MarketCellField =
  | "symbol"
  | "price"
  | "change"
  | "funding"
  | "volume"
  | "oi"
  | "marketCap";

const MARKET_CELL_FIELDS: readonly MarketCellField[] = [
  "symbol",
  "price",
  "change",
  "funding",
  "volume",
  "oi",
  "marketCap",
];

/** A snapshot version bounds the cache: a new snapshot cannot reuse its strings. */
const CACHE_LIMIT = 4000;
const cellCache = new Map<string, string>();

const computeCell = (row: MarketRowData, field: MarketCellField): string => {
  switch (field) {
    case "symbol":
      return row.displaySymbol;
    case "price":
      return formatPrice(row.markPx, row.pxDecimals);
    case "change":
      return formatSignedPercent(row.changePct);
    case "funding":
      return formatFundingPercent(row.funding);
    case "volume":
      return formatCompactUsd(row.volumeUsd);
    case "oi":
      return formatSize(row.openInterest);
    case "marketCap":
      return row.marketCapUsd > 0 ? formatCompactUsd(row.marketCapUsd) : "--";
    default:
      return "";
  }
};

export function formatMarketCell(
  row: MarketRowData,
  field: MarketCellField,
  version: number,
): string {
  const cacheKey = `${row.key}:${field}:${version}`;
  const cached = cellCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const value = computeCell(row, field);
  if (cellCache.size >= CACHE_LIMIT) cellCache.clear();
  cellCache.set(cacheKey, value);
  return value;
}

/** Warms the next screen of rows while the browser is idle after the panel opens. */
export function prewarmMarketCells(
  rows: readonly MarketRowData[],
  version: number,
  count = 40,
): void {
  const limit = Math.min(count, rows.length);
  for (let index = 0; index < limit; index += 1) {
    for (const field of MARKET_CELL_FIELDS) {
      formatMarketCell(rows[index], field, version);
    }
  }
}
