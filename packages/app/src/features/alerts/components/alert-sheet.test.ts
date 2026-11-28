/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { buildCalendarRule, buildQuickRule, shiftPriceByPercent } from "../lib/rule-build";

describe("buildCalendarRule", () => {
  test("arms a calendar rule for the chosen lead and impact floor", () => {
    const rule = buildCalendarRule({
      currency: "US",
      impactMin: "high",
      leadMinutes: 15,
      repeat: "once",
      expiry: "never",
      eventTitle: "CPI",
      eventCountry: "US",
    });

    expect(rule).toMatchObject({
      kind: "calendar",
      summary: "CPI (US) in 15 min",
      condition: {
        subject: "calendar:USD",
        impactMin: "high",
        leadMinutes: 15,
      },
    });
  });
});

describe("quick alert rule", () => {
  test("maps the repeat checkbox and the percent chips onto a price rule", () => {
    const once = buildQuickRule({
      symbol: "BTC",
      operator: "above",
      value: 101_000,
      repeatEvery10Min: false,
    });
    expect(once).toMatchObject({
      kind: "price",
      once: true,
      cooldown_seconds: 0,
      for_seconds: 0,
      expires_at: null,
      condition: { subject: "price:BTC", op: "gte", value: 101_000 },
    });

    const repeated = buildQuickRule({
      symbol: "BTC",
      operator: "below",
      value: 95_000,
      repeatEvery10Min: true,
    });
    expect(repeated).toMatchObject({ once: false, cooldown_seconds: 600 });

    expect(shiftPriceByPercent(100_000, 1)).toBe(101_000);
    expect(shiftPriceByPercent(100_000, 5)).toBe(105_000);
    expect(shiftPriceByPercent(100_000, -1)).toBe(99_000);
    expect(shiftPriceByPercent(100_000, -5)).toBe(95_000);
  });
});
