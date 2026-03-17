/**
 * Price Format Hook - Precision for Lightweight Charts
 * @see https://tradingview.github.io/lightweight-charts/docs/api/interfaces/PriceFormatCustom
 * @memoized - only recalculates when pxDecimals or currentPrice changes
 *
 * Follows Hyperliquid orderbook precision logic:
 * - nSigFigs approach: step = 10^(mag - nSigFigs + 1)
 * - If step >= 1: show whole numbers (0 decimals)
 * - If step < 1: use pxDecimals for precision
 */

import { useMemo } from "react";

export interface PriceFormatResult {
  precision: number;
  minMove: number;
  formatter?: (price: number) => string;
}

/**
 * Format price for chart axis
 * Uses price magnitude to determine decimals - exact match with orderbook formatPriceWithScaling:
 * - scaling >= 1000: decimals = 0 (large step = whole numbers)
 * - scaling >= 1: decimals = 0
 * - scaling < 1: decimals = -log10(scaling) capped at 6
 * Uses toLocaleString("en-US") to match orderbook formatting (with commas)
 */
function formatPriceAxis(price: number, pxDecimals: number): string {
  if (!Number.isFinite(price) || price === 0) return "0";

  // Calculate scaling from price magnitude - same as orderbook generateTickSizeOptions
  const mag = Math.floor(Math.log10(price));
  const scaling = Math.pow(10, mag - 5 + 1); // Using 5 sig figs like orderbook default

  let decimals: number;
  if (scaling >= 1000) decimals = 0;
  else if (scaling >= 1) decimals = 0;
  else decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(scaling))));

  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
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
 * Uses pxDecimals directly - this is the precision from Hyperliquid
 */
function calcMinMove(pxDecimals: number): number {
  return Math.pow(10, -pxDecimals);
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
