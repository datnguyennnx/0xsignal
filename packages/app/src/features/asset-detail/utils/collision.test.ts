/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { clampToMin, getResizeBounds } from "./collision";
import { GRID_COLS, MAX_GRID_ROWS, RESIZE_ROW_CEILING } from "./constants";
import type { LayoutItem } from "./types";

function item(i: string, x: number, y: number, w: number, h: number): LayoutItem {
  return { i, x, y, w, h };
}

describe("getResizeBounds", () => {
  test("a neighbour below does not narrow the bottom; growth runs to the ceiling", () => {
    const bounds = getResizeBounds(item("chart", 0, 0, 16, 16), [item("positions", 0, 16, 16, 5)]);

    expect(bounds.maxY).toBe(RESIZE_ROW_CEILING);
  });

  test("the ceiling sits above the default canvas height", () => {
    expect(RESIZE_ROW_CEILING).toBeGreaterThan(MAX_GRID_ROWS);
  });

  test("a neighbour above still bounds the top edge", () => {
    const bounds = getResizeBounds(item("positions", 0, 5, 16, 5), [item("chart", 0, 0, 16, 5)]);

    expect(bounds.minY).toBe(5);
    expect(bounds.maxY).toBe(RESIZE_ROW_CEILING);
  });

  test("a full-width panel keeps the whole column range", () => {
    const bounds = getResizeBounds(item("chart", 0, 0, GRID_COLS, 8), []);

    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(GRID_COLS);
  });

  test("a right neighbour bounds the right edge", () => {
    const bounds = getResizeBounds(item("chart", 0, 0, 16, 8), [item("orderbook", 16, 0, 5, 16)]);

    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(16);
  });
});

describe("clampToMin", () => {
  test("raises a height below the panel minimum", () => {
    const clamped = clampToMin(item("chart", 0, 0, 16, 2));

    expect(clamped.h).toBe(6);
    expect(clamped.minH).toBe(6);
  });

  test("caps a height above the ceiling at the resize ceiling, not the default canvas height", () => {
    const clamped = clampToMin(item("chart", 0, 0, 16, 600));

    expect(clamped.h).toBe(RESIZE_ROW_CEILING);
    expect(clamped.h).toBeGreaterThan(MAX_GRID_ROWS);
  });

  test("leaves a height past the default canvas but under the ceiling uncapped", () => {
    const clamped = clampToMin(item("chart", 0, 0, 16, 40));

    expect(clamped.h).toBe(40);
  });

  test("subtracts the item's row offset from the ceiling", () => {
    const clamped = clampToMin(item("chart", 0, 100, 16, 600));

    expect(clamped.h).toBe(RESIZE_ROW_CEILING - 100);
  });
});
