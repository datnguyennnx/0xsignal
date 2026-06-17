import { type DisplayOrderbookLevel as OrderbookLevel } from "@/core/utils/hyperliquid";
import { formatPriceWithScaling, formatSize } from "@/core/utils/formatters";

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

export interface FormattedLevel extends OrderbookLevel {
  formattedPrice: string;
  formattedSize: string;
  formattedTotal: string;
}

export function formatLevel(level: OrderbookLevel, scaling: number): FormattedLevel {
  return {
    ...level,
    formattedPrice: level.price > 0 ? formatPriceWithScaling(level.price, scaling) : "-",
    formattedSize: level.price > 0 ? formatSize(level.size) : "-",
    formattedTotal: level.price > 0 ? formatSize(level.total) : "-",
  };
}

/** Convert size/total to quote denomination. Rounds to 2 decimals to prevent float jitter. */
export function toQuoteDenom(level: OrderbookLevel): OrderbookLevel {
  const size = Math.round(level.price * level.size * 100) / 100;
  const total = Math.round(level.price * level.total * 100) / 100;
  return { ...level, size, total };
}
