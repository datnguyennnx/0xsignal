/**
 * Price Format Hook - Precision for Lightweight Charts
 * @see https://tradingview.github.io/lightweight-charts/docs/api/interfaces/PriceFormatCustom
 * @memoized - only recalculates when pxDecimals changes
 */

import { useMemo } from "react";

export interface PriceFormatResult {
  precision: number;
  minMove: number;
  formatter?: (price: number) => string;
}

const MAX_DECIMALS = 6;

/**
 * Format price for chart axis - uses fixed decimals based on pxDecimals
 * This ensures price scale shows consistent granularity
 */
function formatPriceAxis(price: number, pxDecimals: number): string {
  if (!Number.isFinite(price) || price === 0) return "0";

  const absPrice = Math.abs(price);

  // Handle large prices (>= 1000) with K/M/B notation
  if (absPrice >= 1_000_000_000) {
    return `${(price / 1_000_000_000).toFixed(2)}B`;
  }
  if (absPrice >= 1_000_000) {
    return `${(price / 1_000_000).toFixed(2)}M`;
  }
  if (absPrice >= 1_000) {
    return `${(price / 1_000).toFixed(2)}K`;
  }

  // Use fixed decimals = pxDecimals for axis
  // This allows chart to show all price levels based on minMove
  return price.toFixed(pxDecimals);
}

/**
 * Format price for tooltip - shows full precision
 */
function formatPriceTooltip(price: number, pxDecimals: number): string {
  if (!Number.isFinite(price) || price === 0) return "0";
  return price.toFixed(pxDecimals);
}

/**
 * Calculate minMove for price scale granularity
 *
 * minMove determines the price step between visible price levels
 * Smaller = more detail when zoomed in
 */
function calcMinMove(pxDecimals: number): number {
  // Use pxDecimals directly - this is the precision from Hyperliquid
  // pxDecimals=5 -> minMove=0.00001 (shows 0.00001, 0.00002, etc.)
  // pxDecimals=6 -> minMove=0.000001 (shows 0.000001, 0.000002, etc.)
  return 1 / Math.pow(10, pxDecimals);
}

export const usePriceFormat = (pxDecimals?: number): PriceFormatResult => {
  return useMemo(() => {
    // Default to 5 decimals if not provided (for small altcoins)
    const decimals = pxDecimals ?? 5;

    return {
      precision: decimals,
      minMove: calcMinMove(decimals),
      formatter: (price: number) => formatPriceAxis(price, decimals),
    };
  }, [pxDecimals]);
};
