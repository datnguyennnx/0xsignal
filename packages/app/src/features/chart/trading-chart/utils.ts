/**
 * @overview Trading Chart Format Utilities
 *
 * Helper for formatting price values displayed in the OHLC overlay.
 * Uses the asset's pxDecimals from Hyperliquid metadata for correct precision.
 *
 * @precision-formula
 * pxDecimals = min(5, MAX_DECIMALS - szDecimals) per Hyperliquid spec
 * Trailing zeros are stripped for compact display (e.g., 42000.00 → 42000).
 */

export function formatPriceValue(price: number, pxDecimals: number): string {
  if (!Number.isFinite(price) || price === 0) return "0";

  const clampedDecimals = Math.max(0, Math.min(8, pxDecimals));
  const formatted = price.toFixed(clampedDecimals);
  if (formatted.includes(".")) {
    return formatted.replace(/\.?0+$/, "") || "0";
  }
  return formatted;
}
