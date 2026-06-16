export function formatPriceValue(price: number, pxDecimals: number): string {
  if (!Number.isFinite(price) || price === 0) return "0";

  const clampedDecimals = Math.max(0, Math.min(8, pxDecimals));
  const formatted = price.toFixed(clampedDecimals);
  if (formatted.includes(".")) {
    return formatted.replace(/\.?0+$/, "") || "0";
  }
  return formatted;
}
