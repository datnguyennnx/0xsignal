import { describe, expect, test } from "bun:test";

import { priceKey } from "./hyperliquid";

describe("priceKey", () => {
  test("distinct for prices that collide under toFixed(8)", () => {
    expect(priceKey("bid", 0.000000001)).not.toBe(priceKey("bid", 0.000000002));
  });

  test("stable across calls", () => {
    expect(priceKey("bid", 74049)).toBe(priceKey("bid", 74049));
  });

  test("bid and ask prefixes differ", () => {
    expect(priceKey("bid", 74049)).not.toBe(priceKey("ask", 74049));
  });

  test("numerically equal prices share a key", () => {
    expect(priceKey("bid", 74049)).toBe(priceKey("bid", Number("74049")));
  });

  test("twenty levels spaced by 1e-9 produce twenty distinct keys", () => {
    const base = 74049;
    const keys = Array.from({ length: 20 }, (_, index) => priceKey("bid", base + index * 1e-9));

    expect(new Set(keys).size).toBe(20);
  });
});
