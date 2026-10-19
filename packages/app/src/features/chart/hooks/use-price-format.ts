import { useMemo } from "react";

import { formatAxis } from "@/core/utils/formatters";

export interface PriceFormatResult {
  precision: number;
  minMove: number;
  formatter?: (price: number) => string;
}

function formatPriceAxis(price: number, _pxDecimals: number): string {
  if (!Number.isFinite(price) || price === 0) return "0";
  return formatAxis(price);
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
