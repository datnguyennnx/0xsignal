/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { computeVisibleRange, VISIBLE_RANGE_OVERSCAN, visibleSymbols } from "./use-visible-range";

const viewport = { viewportHeight: 400, rowHeight: 40, total: 10, overscan: 3 };

describe("computeVisibleRange", () => {
  test("the top of the list clamps the upper overscan at row zero", () => {
    expect(computeVisibleRange({ ...viewport, scrollTop: 0 })).toEqual({
      startIndex: 0,
      endIndex: 10,
    });
  });

  test("one row of scroll still starts at the first row", () => {
    expect(computeVisibleRange({ ...viewport, scrollTop: 40 })).toEqual({
      startIndex: 0,
      endIndex: 10,
    });
  });

  test("a stale offset past the end clamps to the total without inverting", () => {
    expect(computeVisibleRange({ ...viewport, scrollTop: 400 })).toEqual({
      startIndex: 7,
      endIndex: 10,
    });
  });

  test("a long list renders the visible rows plus three rows on each side", () => {
    const range = computeVisibleRange({ ...viewport, total: 200, scrollTop: 4000 });

    expect(range).toEqual({ startIndex: 97, endIndex: 113 });
    expect(range.endIndex - range.startIndex).toBe(16);
  });

  test("an empty list or zero row height yields an empty window", () => {
    expect(computeVisibleRange({ ...viewport, scrollTop: 0, total: 0 })).toEqual({
      startIndex: 0,
      endIndex: 0,
    });
    expect(computeVisibleRange({ ...viewport, scrollTop: 0, rowHeight: 0 })).toEqual({
      startIndex: 0,
      endIndex: 0,
    });
  });

  test("the default overscan is three", () => {
    expect(VISIBLE_RANGE_OVERSCAN).toBe(3);
    const range = computeVisibleRange({
      viewportHeight: 400,
      rowHeight: 40,
      total: 200,
      scrollTop: 4000,
    });
    expect(range.endIndex - range.startIndex).toBe(16);
  });
});

describe("visibleSymbols", () => {
  test("slices exactly the computed window", () => {
    const symbols = Array.from({ length: 200 }, (_, index) => `COIN${index}`);
    const range = computeVisibleRange({ ...viewport, total: symbols.length, scrollTop: 4000 });

    expect(visibleSymbols(symbols, range)).toEqual(symbols.slice(97, 113));
    expect(visibleSymbols(symbols, range)).toHaveLength(16);
  });

  test("scrolling 200 rows never yields more than the window plus overscan", () => {
    const symbols = Array.from({ length: 200 }, (_, index) => `COIN${index}`);

    for (const scrollTop of [0, 40, 400, 2000, 4000, 7960]) {
      const range = computeVisibleRange({ ...viewport, total: symbols.length, scrollTop });
      expect(visibleSymbols(symbols, range).length).toBeLessThanOrEqual(16);
    }
  });
});
