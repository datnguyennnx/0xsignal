import { type DisplayOrderbookLevel as OrderbookLevel } from "@/core/utils/hyperliquid";
import { formatPriceWithNSigFigs, formatSize } from "@/core/utils/formatters";

export const ROW_HEIGHT = 28;
export const ROW_STYLE = { height: ROW_HEIGHT };
export const VISIBLE_ROWS = 20;

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

// Module-level cache: avoid object allocation per row per tick.
// Keyed by price+nSigFigs identity — levels with same price produce same formatted output.
const formatCache = new Map<string, FormattedLevel>();

const makeFormatKey = (price: number, nSigFigs: number): string =>
  `${price.toFixed(8)}-${nSigFigs}`;

export function formatLevel(level: OrderbookLevel, nSigFigs: number): FormattedLevel {
  const key = makeFormatKey(level.price, nSigFigs);
  const cached = formatCache.get(key);
  if (cached && cached.size === level.size && cached.total === level.total) {
    return cached;
  }

  const formatted: FormattedLevel = {
    ...level,
    formattedPrice: level.price > 0 ? formatPriceWithNSigFigs(level.price, nSigFigs) : "-",
    formattedSize: level.price > 0 ? formatSize(level.size) : "-",
    formattedTotal: level.price > 0 ? formatSize(level.total) : "-",
  };

  // Evict oldest entry if cache grows (prevent leak over long sessions)
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
