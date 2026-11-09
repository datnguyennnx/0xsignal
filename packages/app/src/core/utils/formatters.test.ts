/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import {
  MAX_SIG_FIGS,
  formatAxis,
  formatPrice,
  formatPriceWithNSigFigs,
  formatterCacheSizeForTest,
  getFormatterForTest,
  resetFormatterCacheForTest,
} from "./formatters";

const PRICE_DECIMALS = [2, 3, 4, 5, undefined] as const;

const prices = [
  0, -0, 0.0000001, 0.00001234, 0.5, 1, 1.234, 999.999, 1000, 1234.5678, 1234567.89, -0.000001,
  -0.5, -1.234, -1234.56, -9876543.21,
];

const freshPrice = (price: number, pxDecimals?: number): string => {
  const maxDec = pxDecimals ?? Math.min(MAX_SIG_FIGS, 6);
  const config =
    price >= 1000
      ? { min: Math.min(2, maxDec), max: Math.min(2, maxDec) }
      : price >= 1
        ? { min: Math.min(2, maxDec), max: Math.min(4, maxDec) }
        : { min: Math.min(4, maxDec), max: Math.min(6, maxDec) };
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: config.min,
    maximumFractionDigits: config.max,
  }).format(price);
};

const freshSigFigs = (price: number, n: number): string => {
  if (price <= 0 || n <= 0) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(price);
  }
  const decimals = Math.max(0, n - Math.floor(Math.log10(Math.abs(price))) - 1);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
};

const freshAxis = (value: number): string => {
  if (Math.abs(value) >= 10_000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
};

describe("cached formatters match freshly constructed ones", () => {
  test("formatPrice", () => {
    for (const pxDecimals of PRICE_DECIMALS) {
      for (const price of prices) {
        expect(formatPrice(price, pxDecimals)).toBe(freshPrice(price, pxDecimals));
      }
    }
  });

  test("formatPriceWithNSigFigs", () => {
    for (const n of [2, 3, 4, 5, 0]) {
      for (const price of [0, -0.5, 1e-8, 0.00012345, 0.5, 1.5, 123.456, 99999.9, -12345.6]) {
        expect(formatPriceWithNSigFigs(price, n)).toBe(freshSigFigs(price, n));
      }
    }
  });

  test("formatAxis", () => {
    for (const value of [
      0, 0.5, -1.234, 9999.995, 10_000, 12_345.678, 1_234_567, -1234.5, -12345,
    ]) {
      expect(formatAxis(value)).toBe(freshAxis(value));
    }
  });

  test("pins the literal output so locale or option drift cannot pass silently", () => {
    expect(formatPrice(1234.56)).toBe("$1,234.56");
    expect(formatPrice(-1234.56)).toBe("-$1,234.5600");
    expect(formatPrice(-1234.56, 2)).toBe("-$1,234.56");
    expect(formatPrice(0.5)).toBe("$0.5000");
    expect(formatPrice(1.234, 4)).toBe("$1.234");
    expect(formatPriceWithNSigFigs(1.5, 5)).toBe("1.5000");
    expect(formatPriceWithNSigFigs(12_345.6, 3)).toBe("12,346");
    expect(formatPriceWithNSigFigs(0, 3)).toBe("0");
    expect(formatAxis(1234.5)).toBe("1,234.5");
    expect(formatAxis(12_345)).toBe("12.3K");
    expect(formatAxis(-1_234_567)).toBe("-1.2M");
  });
});

describe("formatter cache", () => {
  test("reuses one Intl.NumberFormat per option key", () => {
    resetFormatterCacheForTest();

    const first = getFormatterForTest("en-US", { maximumFractionDigits: 2 });
    const second = getFormatterForTest("en-US", { maximumFractionDigits: 2 });

    expect(second).toBe(first);
    expect(formatterCacheSizeForTest()).toBe(1);

    formatAxis(1.5);
    formatAxis(2.5);

    expect(getFormatterForTest("en-US", { maximumFractionDigits: 2 })).toBe(first);
    expect(formatterCacheSizeForTest()).toBe(1);
  });

  test("stays bounded and keeps formatting after eviction", () => {
    resetFormatterCacheForTest();
    expect(formatterCacheSizeForTest()).toBe(0);

    for (let n = 2; n <= 80; n += 1) {
      formatPriceWithNSigFigs(1.5, n);
      expect(formatterCacheSizeForTest()).toBeLessThanOrEqual(64);
    }

    expect(formatterCacheSizeForTest()).toBe(64);
    expect(formatPrice(1234.56)).toBe(freshPrice(1234.56));
  });
});
