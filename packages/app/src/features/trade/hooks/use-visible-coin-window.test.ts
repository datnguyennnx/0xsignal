/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { MarketRowData } from "../lib/market-row-data";
import { computeWindow } from "../lib/market-window";
import { visibleCoinsOf } from "../lib/visible-coins";
import { computeVisibleCoinWindow, scrollOffsetOf } from "./use-visible-coin-window";

const VISIBLE_COIN_OVERSCAN = 8;

const makeRow = (midKey: string, marketType: MarketRowData["marketType"]): MarketRowData => ({
  key: `${marketType}:${midKey}`,
  coin: midKey,
  rawCoin: midKey,
  displaySymbol: midKey,
  name: midKey,
  midKey,
  markPx: 1,
  prevDayPx: 1,
  changePct: 0,
  volumeUsd: 1,
  openInterest: 0,
  funding: 0,
  marketCapUsd: 0,
  pxDecimals: 2,
  marketType,
  maxLeverage: 1,
  dexPrefix: null,
  isHip3: false,
  category: "all",
  isLive: true,
});

const rows = Array.from({ length: 200 }, (_, index) => makeRow(`COIN${index}`, "perp"));
const viewport = { viewportHeight: 290, rowHeight: 29 };

const expectedCoins = (input: { scrollTop: number }) => {
  const range = computeWindow({
    ...viewport,
    ...input,
    total: rows.length,
    overscan: VISIBLE_COIN_OVERSCAN,
  });
  return visibleCoinsOf(rows, range);
};

describe("computeVisibleCoinWindow", () => {
  test("derives coins from the same window math as the renderer", () => {
    for (const scrollTop of [0, 29, 290, 2900, 5700]) {
      expect(computeVisibleCoinWindow(rows, { ...viewport, scrollTop }).visibleCoins).toEqual(
        expectedCoins({ scrollTop }),
      );
    }
  });

  test("an event-like scroll offset drives the same coins", () => {
    const event = { currentTarget: { scrollTop: 290 } };
    const scrollTop = scrollOffsetOf(event);

    expect(scrollTop).toBe(290);
    expect(computeVisibleCoinWindow(rows, { ...viewport, scrollTop }).visibleCoins).toEqual(
      expectedCoins({ scrollTop }),
    );
  });

  test("keeps duplicate and spot filtering from the coin helper", () => {
    const mixed = [
      makeRow("BTC", "perp"),
      makeRow("BTC", "perp"),
      makeRow("PURR/USDC", "spot"),
      makeRow("ETH", "perp"),
    ];

    expect(
      computeVisibleCoinWindow(mixed, { scrollTop: 0, viewportHeight: 400, rowHeight: 40 })
        .visibleCoins,
    ).toEqual(["BTC", "ETH"]);
  });

  test("an empty list yields an empty window", () => {
    const result = computeVisibleCoinWindow([], { ...viewport, scrollTop: 0 });

    expect(result.visibleCoins).toEqual([]);
    expect(result.range).toEqual({ start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 });
  });
});
