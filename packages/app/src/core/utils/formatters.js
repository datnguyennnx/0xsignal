// Centralized formatters - single source of truth
// Currency with B/M/K suffix
export const formatCurrency = (value, decimals = 2) => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(decimals)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(decimals)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
};
// Alias for volume
export const formatVolume = (volume) => formatCurrency(volume, 2);
// Price with dynamic decimals based on magnitude
export const formatPrice = (price) => {
  if (price >= 1)
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
};
// Percent with optional sign
export const formatPercent = (value, showSign = true) => {
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};
// Percent change with 2 decimals
export const formatPercentChange = (value) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};
// Compact number with T/B/M/K suffix
export const formatCompact = (value) => {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
};
// Full currency format (USD)
export const formatUSD = (val) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
// Compact Intl format
export const formatIntlCompact = (val) =>
  new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "short" }).format(val);
//# sourceMappingURL=formatters.js.map
