import { describe, expect, test } from "bun:test";

import { formatAxis, formatPriceWithNSigFigs } from "../../../core/utils/formatters";
import { formatChartPrice } from "./price-format";

const VALUES = [0.076821, 2343.45, 106407.2312, 0.00001234, 1, 0.5, 99999.999];

describe("chart price formatting parity with the orderbook", () => {
  for (const n of [2, 3, 4, 5]) {
    for (const value of VALUES) {
      test(`${value} at n=${n} renders exactly as the orderbook`, () => {
        expect(formatChartPrice(value, n)).toBe(formatPriceWithNSigFigs(value, n));
      });
    }
  }

  test("never falls back to the compact axis formatter", () => {
    for (const value of VALUES) {
      expect(formatChartPrice(value, 5)).not.toBe(formatAxis(value));
    }
  });
});
