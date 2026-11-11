/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { MarketRowData } from "./market-row-data";
import { visibleCoinsOf } from "./visible-coins";

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

const fullRange = (rows: readonly MarketRowData[]) => ({ start: 0, end: rows.length });

describe("visibleCoinsOf", () => {
  test("subscribes perps only, keeping their order", () => {
    const rows = [
      makeRow("BTC-USDH", "perp"),
      makeRow("PURR/USDC", "spot"),
      makeRow("ETH", "perp"),
    ];

    expect(visibleCoinsOf(rows, fullRange(rows))).toEqual(["BTC-USDH", "ETH"]);
  });

  test("respects the requested range", () => {
    const rows = [
      makeRow("A", "perp"),
      makeRow("B", "perp"),
      makeRow("C", "perp"),
      makeRow("D", "perp"),
    ];

    expect(visibleCoinsOf(rows, { start: 1, end: 3 })).toEqual(["B", "C"]);
  });

  test("collapses duplicate coins from the window", () => {
    const rows = [makeRow("BTC", "perp"), makeRow("BTC", "perp"), makeRow("ETH", "perp")];

    expect(visibleCoinsOf(rows, fullRange(rows))).toEqual(["BTC", "ETH"]);
  });

  test("an empty range yields no coins", () => {
    const rows = [makeRow("BTC", "perp")];

    expect(visibleCoinsOf(rows, { start: 1, end: 1 })).toEqual([]);
    expect(visibleCoinsOf([], fullRange([]))).toEqual([]);
  });

  test("preserves a HIP-3 coin verbatim", () => {
    const rows = [makeRow("xyz:BTC", "perp")];

    expect(visibleCoinsOf(rows, fullRange(rows))).toEqual(["xyz:BTC"]);
  });
});
