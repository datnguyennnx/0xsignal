import { formatPrice } from "@/core/utils/formatters";

export function formatPriceValue(price: number, pxDecimals: number): string {
  if (!Number.isFinite(price) || price === 0) return "0";
  return formatPrice(price, pxDecimals);
}
