/**
 * @overview Dynamic Price Formatting Hook
 *
 * Provides a custom price formatter for the Lightweight Charts axis based on n-sig-figs (significant figures).
 * Aligns chart precision with the Hyperliquid orderbook's tick size logic.
 *
 * @mechanism
 * - utilizes toLocaleString("en-US") for consistent numeric formatting.
 * - calculates scaling dynamically based on price magnitude to maintain readable precision across different assets.
 * - sigFigs derived from Hyperliquid metadata: min(5, MAX_DECIMALS - szDecimals)
 */

import { useMemo } from "react";

const MAX_SIG_FIGS = 5;

export interface PriceFormatResult {
  precision: number;
  minMove: number;
  formatter?: (price: number) => string;
}

function formatPriceAxis(price: number, pxDecimals: number): string {
  if (!Number.isFinite(price) || price === 0) return "0";

  if (Math.abs(price) <= 200) {
    const decimals = Math.min(20, Math.max(0, pxDecimals));
    return price.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const mag = Math.floor(Math.log10(Math.abs(price)));
  const scaling = Math.pow(10, mag - MAX_SIG_FIGS + 1);

  let decimals: number;
  if (scaling >= 1) decimals = 0;
  else decimals = Math.max(0, Math.min(20, -Math.floor(Math.log10(scaling))));

  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function calcMinMove(pxDecimals: number): number {
  return Math.pow(10, -pxDecimals);
}

export const usePriceFormat = (pxDecimals: number): PriceFormatResult => {
  return useMemo(() => {
    return {
      precision: pxDecimals,
      minMove: calcMinMove(pxDecimals),
      formatter: (price: number) => formatPriceAxis(price, pxDecimals),
    };
  }, [pxDecimals]);
};
