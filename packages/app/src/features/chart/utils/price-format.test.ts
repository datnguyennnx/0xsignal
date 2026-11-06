import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { RAW_PRICE_NSIG_FIGS, formatAxis } from "../../../core/utils/formatters";
import {
  getEffectiveNSigFigs,
  resolveBookDisplayNSigFigs,
} from "../../trade/utils/orderbook-widget-shared";
import { formatLevel } from "../../trade/utils/orderbook-utils";
import { useTradeUIStore } from "../../../stores/use-trade-ui-store";
import { CHART_PRICE_NSIG_FIGS, formatChartPrice } from "./price-format";

const VALUES = [0.076821, 2343.45, 106407.2312, 0.00001234, 1, 0.5, 99999.999];
const SYMBOL = "BTC";

const CHART_GOLDEN_N5: [number, string][] = [
  [0.076821, "0.076821"],
  [2343.45, "2,343.5"],
  [106407.2312, "106,407"],
  [0.00001234, "0.000012340"],
  [1, "1.0000"],
  [0.5, "0.50000"],
  [99999.999, "100,000"],
];

const BOOK_GOLDEN: Record<number, string[]> = {
  2: ["0.077", "2,343", "106,407", "0.000012", "1.0", "0.50", "100,000"],
  3: ["0.0768", "2,343", "106,407", "0.0000123", "1.00", "0.500", "100,000"],
  4: ["0.07682", "2,343", "106,407", "0.00001234", "1.000", "0.5000", "100,000"],
  5: ["0.076821", "2,343.5", "106,407", "0.000012340", "1.0000", "0.50000", "100,000"],
};

function bookRow(selectorValue: number, price: number): string {
  const effective = getEffectiveNSigFigs({ symbol: SYMBOL, value: selectorValue }, SYMBOL, [
    { value: 0 },
    { value: 2 },
    { value: 3 },
    { value: 4 },
    { value: 5 },
  ]);
  return formatLevel(price, 1, 1, resolveBookDisplayNSigFigs(effective)).formattedPrice;
}

describe("chart price formatting parity with the orderbook", () => {
  for (const [value, expected] of CHART_GOLDEN_N5) {
    test(`${value} at n=5 renders the golden string`, () => {
      expect(formatChartPrice(value, 5)).toBe(expected);
    });
  }

  test("0.00001234 at n=2 renders the golden string", () => {
    expect(formatChartPrice(0.00001234, 2)).toBe("0.000012");
  });

  test("never falls back to the compact axis formatter", () => {
    for (const value of VALUES) {
      expect(formatChartPrice(value, 5)).not.toBe(formatAxis(value));
    }
  });
});

describe("chart precision is decoupled from the order-book selector", () => {
  const SAMPLES = [0.076821, 2343.45, 106407.2312, 0.00001234];

  let originalNSigFigs: number | null = null;

  beforeEach(() => {
    originalNSigFigs = useTradeUIStore.getState().nSigFigs;
  });

  afterEach(() => {
    useTradeUIStore.setState({ nSigFigs: originalNSigFigs });
  });

  test("selector 2 and selector 5 yield identical chart output, equal to the book's Raw rendering", () => {
    const renderAtSelector = (selector: number): string[] => {
      useTradeUIStore.setState({ nSigFigs: selector });
      expect(useTradeUIStore.getState().nSigFigs).toBe(selector);
      return SAMPLES.map((price) => formatChartPrice(price));
    };

    const atTwo = renderAtSelector(2);
    const atFive = renderAtSelector(5);

    expect(atTwo).toEqual(atFive);
    for (const [index, price] of SAMPLES.entries()) {
      const raw = bookRow(0, price);
      expect(atTwo[index]).toBe(raw);
      expect(atFive[index]).toBe(raw);
    }
  });

  test("the pinned chart precision is the book's Raw precision", () => {
    expect(CHART_PRICE_NSIG_FIGS).toBe(RAW_PRICE_NSIG_FIGS);
  });
});

describe("the order book still follows the selector", () => {
  for (const selectorValue of [2, 3, 4, 5]) {
    test(`book rows render the golden strings at n=${selectorValue}`, () => {
      const expected = BOOK_GOLDEN[selectorValue];
      for (const [index, price] of VALUES.entries()) {
        expect(bookRow(selectorValue, price)).toBe(expected[index]);
      }
    });
  }

  test("selector 2 and selector 5 differ for a sub-1 price", () => {
    expect(bookRow(2, 0.076821)).not.toBe(bookRow(5, 0.076821));
  });

  test("Raw renders at the pinned precision, not at a selector value", () => {
    expect(bookRow(0, 0.076821)).toBe("0.076821");
  });
});
