import { useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";

interface PriceFormatResult {
  precision: number;
  minMove: number;
  formatter?: (price: number) => string;
}

export const usePriceFormat = (data: ChartDataPoint[], symbol: string): PriceFormatResult => {
  // Use the very first price we see for this symbol as the baseline for magnitude.
  // We only re-calculate if the symbol itself changes.
  const firstPrice = data.length > 0 ? data[0].close : 0;

  return useMemo(() => {
    if (firstPrice === 0) return { precision: 2, minMove: 0.01 };

    let precision: number;
    if (firstPrice >= 1000) {
      precision = 2;
    } else {
      const str = firstPrice.toString();
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
  }, [symbol, firstPrice > 0]);
};
