/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { deriveMarkPrice } from "./trade-math";

describe("deriveMarkPrice", () => {
  test("divides mark-based notional by absolute size", () => {
    expect(deriveMarkPrice("25000", "10")).toBe(2500);
    expect(deriveMarkPrice("25000", "-10")).toBe(2500);
  });

  test("a flat position has no mark and never yields NaN or Infinity", () => {
    expect(deriveMarkPrice("0", "0")).toBeNull();
  });
});
