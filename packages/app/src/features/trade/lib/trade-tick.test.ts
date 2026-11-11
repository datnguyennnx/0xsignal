/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { WsTrade } from "@0xsignal/sdk-hyperliquid/subscription";
import { cast, type DecimalString } from "@0xsignal/sdk-hyperliquid";

import { MAX_TRADE_TICKS, toTradeTicks } from "./trade-tick";

const decimal = (value: string): DecimalString => cast<DecimalString>(value, "trade");

const trade = (overrides: Partial<WsTrade> = {}): WsTrade => ({
  coin: "BTC",
  side: "B",
  px: decimal("74049.0"),
  sz: decimal("0.22207"),
  hash: "0xabc",
  time: 1794388497188,
  tid: 123,
  users: ["0x1", "0x2"],
  ...overrides,
});

describe("toTradeTicks", () => {
  test("keeps every tick of a batch in wire order", () => {
    const ticks = toTradeTicks([
      trade({ tid: 1, px: decimal("100.5") }),
      trade({ tid: 2, px: decimal("101.5") }),
      trade({ tid: 3, px: decimal("102.5") }),
    ]);

    expect(ticks).toHaveLength(3);
    expect(ticks.map((tick) => tick.tid)).toEqual([1, 2, 3]);
    expect(ticks.map((tick) => tick.px)).toEqual([100.5, 101.5, 102.5]);
    expect(MAX_TRADE_TICKS).toBe(50);
  });

  test("maps buyer-initiated B to buy and seller-initiated A to sell", () => {
    const ticks = toTradeTicks([trade({ side: "B" }), trade({ side: "A" })]);

    expect(ticks.map((tick) => tick.side)).toEqual(["buy", "sell"]);
  });

  test("drops ticks whose price or size does not parse to a finite number", () => {
    const ticks = toTradeTicks([
      trade({ tid: 1, px: decimal("not-a-number") }),
      trade({ tid: 2 }),
      trade({ tid: 3, sz: decimal("Infinity") }),
    ]);

    expect(ticks.map((tick) => tick.tid)).toEqual([2]);
  });

  test("normalizes an empty hash and an absent tid to null", () => {
    const withoutTid: Partial<WsTrade> = { ...trade({ hash: "" }) };
    delete withoutTid.tid;
    const [tick] = toTradeTicks([withoutTid as WsTrade]);

    expect(tick?.hash).toBeNull();
    expect(tick?.tid).toBeNull();
  });

  test("carries the captured frame values through", () => {
    const [tick] = toTradeTicks([
      {
        coin: "BTC",
        side: "B",
        px: decimal("74049.0"),
        sz: decimal("0.22207"),
        hash: "0xabc",
        time: 1794388497188,
        tid: 123,
        users: ["0x1", "0x2"],
      },
    ]);

    expect(tick).toEqual({
      px: 74049,
      sz: 0.22207,
      time: 1794388497188,
      side: "buy",
      hash: "0xabc",
      tid: 123,
    });
  });
});
