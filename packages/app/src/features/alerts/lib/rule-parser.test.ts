/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { parseRule } from "./rule-parser";

describe("price sentences", () => {
  test("reads a level from a notify sentence", () => {
    expect(parseRule("notify me when price BTC is above 42000")).toEqual({
      kind: "price",
      symbol: "BTC",
      op: "gte",
      value: 42000,
    });
  });

  test("reads a greater-than operator", () => {
    expect(parseRule("BTC > 42,000")).toEqual({
      kind: "price",
      symbol: "BTC",
      op: "gte",
      value: 42000,
    });
  });

  test("reads a break as an upside trigger", () => {
    expect(parseRule("btc breaks 42k")).toEqual({
      kind: "price",
      symbol: "BTC",
      op: "gte",
      value: 42000,
    });
  });

  test("reads a drop below", () => {
    expect(parseRule("alert me when eth drops below 2000")).toEqual({
      kind: "price",
      symbol: "ETH",
      op: "lte",
      value: 2000,
    });
  });

  test("reads goes under", () => {
    expect(parseRule("tell me when sol goes under 150")).toEqual({
      kind: "price",
      symbol: "SOL",
      op: "lte",
      value: 150,
    });
  });

  test("ignores trailing punctuation", () => {
    expect(parseRule("BTC > 42,000.")).toEqual({
      kind: "price",
      symbol: "BTC",
      op: "gte",
      value: 42000,
    });
  });
});

describe("calendar sentences", () => {
  test("reads minutes before a default-USD event", () => {
    expect(parseRule("15 min before CPI")).toEqual({
      kind: "calendar",
      currency: "USD",
      leadMinutes: 15,
      impactMin: "high",
    });
  });

  test("reads minutes before a named event", () => {
    expect(parseRule("alert me 30 minutes before FOMC")).toEqual({
      kind: "calendar",
      currency: "USD",
      leadMinutes: 30,
      impactMin: "high",
    });
  });

  test("reads a country prefix and a compact unit", () => {
    expect(parseRule("before US CPI 15m")).toEqual({
      kind: "calendar",
      currency: "USD",
      leadMinutes: 15,
      impactMin: "high",
    });
  });

  test("honours an explicit medium impact", () => {
    expect(parseRule("alert me 15 min before CPI with medium impact")).toEqual({
      kind: "calendar",
      currency: "USD",
      leadMinutes: 15,
      impactMin: "medium",
    });
  });

  test("does not assume USD when the currency is unknown", () => {
    expect(parseRule("15 min before BTC halving")).toBeNull();
  });
});

describe("number formats", () => {
  const cases: [string, number][] = [
    ["42,000", 42_000],
    ["42k", 42_000],
    ["1.5m", 1_500_000],
    ["0.5", 0.5],
  ];

  for (const [amount, value] of cases) {
    test(`reads ${amount}`, () => {
      expect(parseRule(`BTC above ${amount}`)).toEqual({
        kind: "price",
        symbol: "BTC",
        op: "gte",
        value,
      });
    });
  }
});

describe("rejects unclear input", () => {
  test("gibberish", () => {
    expect(parseRule("make me a sandwich")).toBeNull();
  });

  test("a level with no direction", () => {
    expect(parseRule("BTC 42000")).toBeNull();
  });

  test("conflicting directions", () => {
    expect(parseRule("BTC above 42000 and below 40000")).toBeNull();
  });

  test("two candidate symbols", () => {
    expect(parseRule("BTC and ETH above 42000")).toBeNull();
  });

  test("no symbol", () => {
    expect(parseRule("price is above 42000")).toBeNull();
  });

  test("a symbol outside the allowed length", () => {
    expect(parseRule("TOOLONG above 10")).toBeNull();
  });

  test("empty input", () => {
    expect(parseRule("   ")).toBeNull();
  });
});
