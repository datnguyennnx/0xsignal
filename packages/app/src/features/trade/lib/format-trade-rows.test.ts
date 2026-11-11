/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { market } from "../../../test/fixtures";
import type { AssetCtxSnapshot } from "./asset-ctx";
import { computeLiveCells } from "./format-trade-rows";
import { buildMarketRows } from "./market-row-data";

const rowOf = (overrides: Parameters<typeof market>[0] = {}) => {
  const [row] = buildMarketRows([market(overrides)]).rows;
  return row;
};

const ctx = (overrides: Partial<AssetCtxSnapshot> = {}): AssetCtxSnapshot => ({
  markPx: 93732,
  prevDayPx: 92620,
  funding: 0.00000625,
  dayNtlVlm: 563592476.12,
  openInterest: 2175,
  oraclePx: 93732,
  ...overrides,
});

const liveRow = () =>
  rowOf({
    markPx: "93732",
    prevDayPx: "92620",
    funding: "0.00000625",
    dayNtlVlm: "563592476.12",
    openInterest: "2175",
    szDecimals: 4,
  });

describe("computeLiveCells", () => {
  test("renders the Hyperliquid market table fixture", () => {
    expect(computeLiveCells({ row: liveRow(), ctx: ctx(), midPx: 93732 })).toEqual({
      price: "93,732.00",
      change: "+1,112.00 / +1.20%",
      funding: "+0.0050%",
      volume: "$563,592,476",
      openInterest: "$203,867,100",
    });
  });

  test("falls back to REST values when no context exists", () => {
    expect(computeLiveCells({ row: liveRow(), ctx: undefined, midPx: undefined })).toEqual({
      price: "93,732.00",
      change: "+1,112.00 / +1.20%",
      funding: "+0.0050%",
      volume: "$563,592,476",
      openInterest: "$203,867,100",
    });
  });

  test("spot rows show no funding and no open interest", () => {
    const row = rowOf({
      coin: "@1",
      rawCoin: "@1",
      displaySymbol: "PURR/USDC",
      name: "PURR/USDC",
      marketType: "spot",
      markPx: "10",
      prevDayPx: "9",
      funding: "0",
      dayNtlVlm: "5000",
      openInterest: "0",
      szDecimals: 4,
    });
    expect(computeLiveCells({ row, ctx: undefined, midPx: undefined })).toEqual({
      price: "10.00",
      change: "+1.00 / +11.11%",
      funding: "--",
      volume: "$5,000",
      openInterest: "--",
    });
  });

  test("a mark-only tick moves price, change and open interest together", () => {
    const row = liveRow();
    const before = computeLiveCells({ row, ctx: ctx(), midPx: undefined });
    const after = computeLiveCells({
      row,
      ctx: ctx({ markPx: 94000 }),
      midPx: undefined,
    });
    expect(after.price).toBe("94,000.00");
    expect(after.price).not.toBe(before.price);
    expect(after.change).not.toBe(before.change);
    expect(after.openInterest).toBe("$204,450,000");
    expect(after.openInterest).not.toBe(before.openInterest);
  });

  test("an unknown previous day renders the placeholder, not a fake move", () => {
    const row = rowOf({ markPx: "100", prevDayPx: "0", szDecimals: 4 });
    expect(computeLiveCells({ row, ctx: undefined, midPx: undefined }).change).toBe("—");
  });
});
