import { useMemo } from "react";

import { formatChartPrice } from "../utils/price-format";

export interface PriceFormatResult {
  minMove: number;
  formatter: (price: number) => string;
}

function calcMinMove(pxDecimals: number): number {
  return Math.pow(10, -pxDecimals);
}

export const usePriceFormat = (pxDecimals: number, nSigFigs: number): PriceFormatResult => {
  return useMemo(
    () => ({
      minMove: calcMinMove(pxDecimals),
      formatter: (price: number) => formatChartPrice(price, nSigFigs),
    }),
    [pxDecimals, nSigFigs],
  );
};
