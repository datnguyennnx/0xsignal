/**
 * @overview Shared Formatting Utilities
 *
 * Provides consistent display of prices, volumes, and market data across the UI.
 * Handles diverse scaling for crypto pairs (from BTC @ $60k to PEPE @ $0.000001).
 */

/**
 * Formats a numeric price into a localized USD string.
 * Automatically adjusts decimals based on magnitude.
 */
export const formatPrice = (price: number): string => {
  const config =
    price >= 1000 ? { min: 2, max: 2 } : price >= 1 ? { min: 2, max: 4 } : { min: 4, max: 6 };

  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: config.min,
    maximumFractionDigits: config.max,
  });
};

/**
 * Formats large market cap values with B/M/T suffixes.
 */
export const formatMarketCap = (value: number): string => {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
};

/**
 * Formats trading volume with B/M/K suffixes.
 */
export const formatVolume = (value: number): string => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
};

/**
 * Formats orderbook or asset size.
 */
export const formatSize = (size: number): string => {
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(2)}M`;
  if (size >= 1_000) return `${(size / 1_000).toFixed(2)}K`;
  return size.toFixed(size < 1 ? 4 : 2);
};

/**
 * Specialized price formatting with custom scaling factor (Orderbook tick size).
 */
export const formatPriceWithScaling = (price: number, scaling: number): string => {
  let decimals: number;
  if (scaling >= 1000) decimals = 0;
  else if (scaling >= 1) decimals = 0;
  else decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(scaling))));

  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
