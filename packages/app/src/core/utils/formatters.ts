export const formatCurrency = (value: number, decimals = 2): string => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(decimals)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(decimals)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
};

export const formatVolume = (volume: number): string => formatCurrency(volume, 2);

export const formatPrice = (price: number): string => {
  if (price >= 1)
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
};

export const formatPercent = (value: number, showSign = true): string => {
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

export const formatPercentChange = (value: number): string => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};

export const formatCompact = (value: number): string => {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
};

export const formatUSD = (val: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

export const formatIntlCompact = (val: number): string =>
  new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "short" }).format(val);
