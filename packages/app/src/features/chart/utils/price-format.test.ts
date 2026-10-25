import { describe, expect, test } from "bun:test";

import {
  RAW_PRICE_NSIG_FIGS,
  formatAxis,
  formatPriceWithNSigFigs,
} from "../../../core/utils/formatters";
import {
  getEffectiveNSigFigs,
  resolveBookDisplayNSigFigs,
} from "../../trade/utils/orderbook-widget-shared";
import { formatLevel } from "../../trade/utils/orderbook-utils";
import { useTradeUIStore } from "../../../stores/use-trade-ui-store";
import { CHART_PRICE_NSIG_FIGS, formatChartPrice } from "./price-format";

const VALUES = [0.076821, 2343.45, 106407.2312, 0.00001234, 1, 0.5, 99999.999];
const SYMBOL = "BTC";

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

describe("chart precision is decoupled from the order-book selector", () => {
  const SAMPLES = [0.076821, 2343.45, 106407.2312, 0.00001234];

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
  test("book rows render at the selected sig-fig count", () => {
    for (const selectorValue of [2, 3, 4, 5]) {
      for (const price of VALUES) {
        expect(bookRow(selectorValue, price)).toBe(formatPriceWithNSigFigs(price, selectorValue));
      }
    }
    expect(bookRow(2, 0.076821)).not.toBe(bookRow(5, 0.076821));
  });

  test("Raw renders at the pinned precision, not at a selector value", () => {
    expect(bookRow(0, 0.076821)).toBe(bookRow(RAW_PRICE_NSIG_FIGS, 0.076821));
  });
});
