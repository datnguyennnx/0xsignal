/**
 * Price Format Hook - 5 significant figures (Hyperliquid standard)
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
 * Format price following Hyperliquid's 5 significant figures rule
 * @param price - Raw price
 * @param maxDecimals - MAX_DECIMALS from Hyperliquid (6 for perps, 8 for spot)
 */
function formatPrice(price: number, maxDecimals: number): string {
  if (!Number.isFinite(price) || price === 0) return "0";

  const absPrice = Math.abs(price);

  // Integer digits: for price >= 1, count digits; for price < 1, it's 0
  const intDigits = absPrice >= 1 ? Math.floor(Math.log10(absPrice)) + 1 : 0;

  // 5 significant figures: need (5 - intDigits) decimals
  let requiredDecimals = 5 - intDigits;

  // Clamp to valid range [0, maxDecimals]
  requiredDecimals = Math.max(0, Math.min(requiredDecimals, maxDecimals));

  return price.toFixed(requiredDecimals);
}

/**
 * Calculate minMove for smooth chart interaction
 * @docs minMove = 1 / 10^maxDecimals
 */
function calcMinMove(maxDecimals: number): number {
  return 1 / Math.pow(10, maxDecimals);
}

const createFormatter = (maxDecimals: number) => (price: number) => formatPrice(price, maxDecimals);

export const usePriceFormat = (pxDecimals?: number): PriceFormatResult => {
  return useMemo(() => {
    const decimals = pxDecimals ?? 2;
    return {
      precision: decimals,
      minMove: calcMinMove(decimals),
      formatter: createFormatter(decimals),
    };
  }, [pxDecimals]);
};
