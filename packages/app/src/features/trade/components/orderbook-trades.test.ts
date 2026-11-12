/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { TradeTick } from "../lib/trade-tick";
import { buildTradeRows, exchangeTxUrl, tradeRowView } from "../utils/orderbook-trades-view";

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const baseTick = (overrides: Partial<TradeTick> = {}): TradeTick => ({
  px: 123.45,
  sz: 0.5,
  time: Date.UTC(2026, 0, 2, 13, 45, 7),
  side: "buy",
  hash: "0xabc",
  tid: 1,
  ...overrides,
});

describe("exchangeTxUrl", () => {
  test("builds the Hyperliquid explorer link", () => {
    expect(exchangeTxUrl("0xabc")).toBe("https://app.hyperliquid.xyz/explorer/tx/0xabc");
  });
});

describe("tradeRowView", () => {
  test("formats a buy tick", () => {
    const tick = baseTick();
    const view = tradeRowView(tick, "BTC", 5);

    expect(view.price).toBe(123.45);
    expect(view.sizeText).toBe("0.5000");
    expect(view.timeText).toBe(TIME_FORMATTER.format(tick.time));
    expect(view.timeText).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(view.sideClass).toBe("text-data-up");
    expect(view.link).toBe("https://app.hyperliquid.xyz/explorer/tx/0xabc");
  });

  test("formats a sell tick", () => {
    const view = tradeRowView(baseTick({ side: "sell" }), "ETH", 5);

    expect(view.price).toBe(123.45);
    expect(view.sideClass).toBe("text-data-down");
  });

  test("renders no link when the hash is missing", () => {
    const view = tradeRowView(baseTick({ hash: null }), "BTC", 5);

    expect(view.link).toBeNull();
  });

  test("renders the tape price at the book's resolved precision", () => {
    const tick = baseTick({ px: 74094 });

    expect(tradeRowView(tick, "BTC", 5).priceText).toBe("74,094");
    expect(tradeRowView(tick, "BTC", 2).priceText).toBe("74,094");
  });

  test("two precisions produce different strings for the same px", () => {
    const tick = baseTick({ px: 123.45 });

    expect(tradeRowView(tick, "BTC", 5).priceText).toBe("123.45");
    expect(tradeRowView(tick, "BTC", 2).priceText).toBe("123");
  });

  test("a cheap asset keeps its significant decimals at the same precision", () => {
    const tick = baseTick({ px: 0.00012345 });

    expect(tradeRowView(tick, "BTC", 5).priceText).toBe("0.00012345");
    expect(tradeRowView(tick, "BTC", 2).priceText).toBe("0.00012");
  });
});

describe("buildTradeRows", () => {
  test("distinguishes ticks that share time, price, size and side by tid", () => {
    const first = baseTick({ tid: 11 });
    const second = baseTick({ tid: 12 });

    const rows = buildTradeRows([first, second], "BTC", 5);
    const keys = rows.map((row) => row.key);

    expect(new Set(keys).size).toBe(2);
    expect(keys[0]).toBe("tid:11");
    expect(keys[1]).toBe("tid:12");
  });

  test("keys a tid-less tick deterministically", () => {
    const tick = baseTick({ tid: null, hash: null });
    const other = baseTick({ px: 200, tid: null, hash: null });

    const first = buildTradeRows([tick, other], "BTC", 5).map((row) => row.key);
    const second = buildTradeRows([tick, other], "BTC", 5).map((row) => row.key);

    expect(first).toEqual(second);
    expect(first[0]).toBe(`${tick.time}-${tick.px}-${tick.sz}-${tick.side}`);
  });

  test("disambiguates tid-less ticks that are identical", () => {
    const tick = baseTick({ tid: null });

    const keys = buildTradeRows([tick, tick], "BTC", 5).map((row) => row.key);

    expect(new Set(keys).size).toBe(2);
    expect(keys[0]).not.toBe(keys[1]);
  });
});
