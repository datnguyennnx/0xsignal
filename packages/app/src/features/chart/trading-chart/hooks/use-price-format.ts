/**
 * @overview Dynamic Price Formatting Hook
 *
 * Provides a custom price formatter for the Lightweight Charts axis based on n-sig-figs (significant figures).
 * Aligns chart precision with the Hyperliquid orderbook's tick size logic.
 *
 * @mechanism
 * - utilizes toLocaleString("en-US") for consistent numeric formatting.
 * - calculates scaling dynamically based on price magnitude to maintain readable precision across different assets.
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

  // For oscillator values (typically small range like -100 to 100, or small decimals)
  // use pxDecimals directly to avoid invalid decimals calculation
  if (Math.abs(price) <= 200) {
    const decimals = Math.min(20, Math.max(0, pxDecimals));
    return price.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  // Calculate scaling from price magnitude - same as orderbook generateTickSizeOptions
  const mag = Math.floor(Math.log10(Math.abs(price)));
  const scaling = Math.pow(10, mag - 5 + 1); // Using 5 sig figs like orderbook default

  let decimals: number;
  if (scaling >= 1000) decimals = 0;
  else if (scaling >= 1) decimals = 0;
  else decimals = Math.max(0, Math.min(20, -Math.floor(Math.log10(scaling))));

  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
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
