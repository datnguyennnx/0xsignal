import {
  type DisplayOrderbookLevel as OrderbookLevel,
  MAX_BOOK_DEPTH,
} from "@/core/utils/hyperliquid";
import { formatPriceWithNSigFigs, formatSize } from "@/core/utils/formatters";

/** Single source for the depth row box: rows, column header, spread strip and skeleton all use it. */
export const ROW_HEIGHT_CLASS = "h-(--row-dense)";
export const VISIBLE_ROWS = 20;
/** Dense rhythm floor, in rem; stays in sync with ROW_HEIGHT_CLASS (--row-dense = 1.75rem). */
export const MIN_ROW_HEIGHT_REM = 1.75;
/** Readability ceiling for a stretched row, in rem. */
export const MAX_ROW_HEIGHT_REM = 2.5;

export interface PopupData {
  price: number;
  size: number;
  total: number;
  side: "bid" | "ask";
  avgPrice?: number;
  cumulativeSize?: number;
}

interface FormattedLevel extends OrderbookLevel {
  formattedPrice: string;
  formattedSize: string;
  formattedTotal: string;
}

// Module-level cache: avoid per-row allocation per tick, keyed by price+nSigFigs.
const formatCache = new Map<string, FormattedLevel>();

export const makeFormatKey = (price: number, nSigFigs: number): string => `${price}-${nSigFigs}`;

export function formatLevel(
  price: number,
  size: number,
  total: number,
  nSigFigs: number,
): FormattedLevel {
  const key = makeFormatKey(price, nSigFigs);
  const cached = formatCache.get(key);
  if (cached && cached.size === size && cached.total === total) {
    return cached;
  }

  const formatted: FormattedLevel = {
    price,
    size,
    total,
    formattedPrice: price > 0 ? formatPriceWithNSigFigs(price, nSigFigs) : "-",
    formattedSize: price > 0 ? formatSize(size) : "-",
    formattedTotal: price > 0 ? formatSize(total) : "-",
  };

  // Evict oldest entry to bound the cache over long sessions.
  if (formatCache.size > 500) {
    const firstKey = formatCache.keys().next().value;
    if (firstKey !== undefined) formatCache.delete(firstKey);
  }
  formatCache.set(key, formatted);

  return formatted;
}

/** Convert size/total to quote denomination. Rounds to 2 decimals to prevent float jitter. */
export function toQuoteDenom(level: OrderbookLevel): OrderbookLevel {
  const size = Math.round(level.price * level.size * 100) / 100;
  const total = Math.round(level.price * level.total * 100) / 100;
  return { ...level, size, total };
}

/** Rows per side that fit: spread row subtracted, rest split in two; 0 when none fit. */
export function levelsPerHalf(bodyHeightPx: number, rowHeightPx: number): number {
  if (
    !Number.isFinite(bodyHeightPx) ||
    !Number.isFinite(rowHeightPx) ||
    rowHeightPx <= 0 ||
    bodyHeightPx < 3 * rowHeightPx
  ) {
    return 0;
  }
  return Math.floor((bodyHeightPx - rowHeightPx) / (2 * rowHeightPx));
}

/**
 * Level count per half, sized by the dense floor so a tall panel keeps the deepest
 * book the protocol serves instead of trading levels for taller rows.
 */
export function rowsPerHalfFor(bodyHeightPx: number, minRowHeightPx: number): number {
  return Math.min(levelsPerHalf(bodyHeightPx, minRowHeightPx), MAX_BOOK_DEPTH);
}

/**
 * Height for one row once the halves split `availablePx`: the exact quotient in the
 * middle, pinned to the dense floor on a short panel and the readability ceiling on
 * a tall one. `availablePx` is the body minus the spread strip.
 */
export function clampRowHeight(
  availablePx: number,
  rowsPerHalf: number,
  minPx: number,
  maxPx: number,
): number {
  if (
    !Number.isFinite(availablePx) ||
    !Number.isFinite(rowsPerHalf) ||
    !Number.isFinite(minPx) ||
    !Number.isFinite(maxPx) ||
    availablePx <= 0 ||
    rowsPerHalf <= 0
  ) {
    return minPx;
  }
  const quotient = availablePx / (2 * rowsPerHalf);
  const ceiling = Math.max(minPx, maxPx);
  return Math.min(Math.max(quotient, minPx), ceiling);
}
