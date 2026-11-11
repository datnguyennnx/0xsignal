/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { deriveMarkPrice, formatOrderSize } from "./trade-math";

describe("deriveMarkPrice", () => {
  test("divides mark-based notional by absolute size", () => {
    expect(deriveMarkPrice("25000", "10")).toBe(2500);
    expect(deriveMarkPrice("25000", "-10")).toBe(2500);
  });

  test("a flat position has no mark and never yields NaN or Infinity", () => {
    expect(deriveMarkPrice("0", "0")).toBeNull();
  });
});

describe("formatOrderSize", () => {
  test("truncates to szDecimals instead of rounding up", () => {
    expect(formatOrderSize("1.23456", 2)).toBe("1.23");
    expect(formatOrderSize(1.23456, 2)).toBe("1.23");
    expect(formatOrderSize(1.239, 2)).toBe("1.23");
  });

  test("drops trailing zeros at the requested precision", () => {
    expect(formatOrderSize(1.2, 4)).toBe("1.2");
    expect(formatOrderSize(2, 3)).toBe("2");
  });

  test("never emits a compact suffix for large sizes", () => {
    expect(formatOrderSize(1_500_000, 2)).toBe("1500000");
    expect(formatOrderSize(1_500, 2)).not.toContain("K");
  });
});
