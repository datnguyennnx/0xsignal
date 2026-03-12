import { useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";

interface PriceFormatResult {
  precision: number;
  minMove: number;
  formatter?: (price: number) => string;
}

export const usePriceFormat = (data: ChartDataPoint[]): PriceFormatResult => {
  return useMemo(() => {
    if (data.length === 0) return { precision: 2, minMove: 0.01 };
    const prices = data.flatMap((d) => [d.open, d.high, d.low, d.close]);
    const maxPrice = Math.max(...prices.filter((p) => p > 0));
    if (maxPrice === 0) return { precision: 2, minMove: 0.01 };

    let precision: number;
    if (maxPrice >= 1000) {
      precision = 2;
    } else {
      const str = maxPrice.toString();
      const decimalIndex = str.indexOf(".");
      if (decimalIndex === -1) {
        precision = 2;
      } else {
        const decimals = str.slice(decimalIndex + 1);
        let firstNonZero = decimals.length;
        for (let i = 0; i < decimals.length; i++) {
          if (decimals[i] !== "0") {
            firstNonZero = i;
            break;
          }
        }
        precision = Math.min(Math.max(firstNonZero + 2, 2), 6);
      }
    }

    const formatter = (price: number): string => {
      const fixed = price.toFixed(precision);
      return parseFloat(fixed).toString();
    };

    return { precision, minMove: Math.pow(10, -precision), formatter };
  }, [data]);
};
