/**
 * @overview Trading Chart Format Utilities
 *
 * Helper for formatting price values displayed in the OHLC overlay.
 * Uses a significant figures approach to keep display strings compact while maintaining precision.
 */
const MAX_DECIMALS_PERPETUAL = 6;

export function formatPriceValue(
  price: number,
  maxDecimals: number = MAX_DECIMALS_PERPETUAL
): string {
  if (!Number.isFinite(price) || price === 0) return "0";

  const absPrice = Math.abs(price);
  const intDigits = absPrice >= 1 ? Math.floor(Math.log10(absPrice)) + 1 : 1;

  let requiredDecimals = 5 - intDigits;
  requiredDecimals = Math.max(0, Math.min(requiredDecimals, maxDecimals));

  const formatted = price.toFixed(requiredDecimals);
  if (formatted.includes(".")) {
    return formatted.replace(/\.?0+$/, "") || "0";
  }
  return formatted;
}
