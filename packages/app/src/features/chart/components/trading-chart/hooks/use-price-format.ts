import { useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";

export const usePriceFormat = (data: ChartDataPoint[]) => {
  return useMemo(() => {
    if (data.length === 0) return { precision: 2, minMove: 0.01 };
    const prices = data.flatMap((d) => [d.open, d.high, d.low, d.close]);
    const minPrice = Math.min(...prices.filter((p) => p > 0));
    if (minPrice === 0) return { precision: 2, minMove: 0.01 };

    const str = minPrice.toString();
    const decimalIndex = str.indexOf(".");
    if (decimalIndex === -1) return { precision: 0, minMove: 1 };

    const decimals = str.slice(decimalIndex + 1);
    let significantIndex = 0;
    for (let i = 0; i < decimals.length; i++) {
      if (decimals[i] !== "0") {
        significantIndex = i;
        break;
      }
    }
    const precision = Math.min(significantIndex + 3, 10);
    return { precision, minMove: Math.pow(10, -precision) };
  }, [data]);
};
