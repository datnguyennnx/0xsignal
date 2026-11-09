/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { computeWindow } from "./market-window";

const viewport = { viewportHeight: 500, rowHeight: 29, total: 600, overscan: 8 };

describe("computeWindow", () => {
  test("the top of the list starts at zero and renders one screen plus overscan", () => {
    const result = computeWindow({ ...viewport, scrollTop: 0 });
    expect(result.start).toBe(0);
    expect(result.end).toBe(Math.ceil(500 / 29) + 16);
    expect(result.topSpacer).toBe(0);
    expect(result.bottomSpacer).toBe((600 - result.end) * 29);
  });

  test("the middle window is overscanned above and below", () => {
    const result = computeWindow({ ...viewport, scrollTop: 2900 });
    expect(result.start).toBe(100 - 8);
    expect(result.end).toBe(100 + Math.ceil(500 / 29) + 8);
  });

  test("the bottom clamps the end to the total", () => {
    const result = computeWindow({ ...viewport, scrollTop: 600 * 29 - 500 });
    expect(result.end).toBe(600);
    expect(result.bottomSpacer).toBe(0);
  });

  test("a list shorter than the viewport renders in full", () => {
    const result = computeWindow({ ...viewport, total: 5, scrollTop: 0 });
    expect(result).toEqual({ start: 0, end: 5, topSpacer: 0, bottomSpacer: 0 });
  });

  test("negative scroll and overscan are clamped", () => {
    const result = computeWindow({ ...viewport, scrollTop: -400, overscan: -3 });
    expect(result.start).toBe(0);
    expect(result.topSpacer).toBe(0);
  });

  test("an empty list or zero row height yields an empty window", () => {
    expect(computeWindow({ ...viewport, total: 0, scrollTop: 0 })).toEqual({
      start: 0,
      end: 0,
      topSpacer: 0,
      bottomSpacer: 0,
    });
    expect(computeWindow({ ...viewport, rowHeight: 0, scrollTop: 0 })).toEqual({
      start: 0,
      end: 0,
      topSpacer: 0,
      bottomSpacer: 0,
    });
  });

  test("for 600 rows the rendered count stays bounded", () => {
    const result = computeWindow({ ...viewport, scrollTop: 2900 });
    expect(result.end - result.start).toBeLessThanOrEqual(
      Math.ceil(viewport.viewportHeight / viewport.rowHeight) + 2 * viewport.overscan,
    );
  });

  test("a stale scroll offset past the end clamps to the total, never inverts the slice", () => {
    const result = computeWindow({ ...viewport, scrollTop: 19_000 });
    expect(result.start).toBe(600);
    expect(result.end).toBe(600);
    expect(result.start).toBeLessThanOrEqual(600);
    expect(result.end).toBeLessThanOrEqual(600);
    expect(result.start).toBeLessThanOrEqual(result.end);
    expect(result.topSpacer).toBe(600 * 29);
    expect(result.bottomSpacer).toBe(0);
  });

  test("a filtered list shorter than the stale offset still renders a valid window", () => {
    const result = computeWindow({ ...viewport, scrollTop: 19_000, total: 37 });
    expect(result.start).toBe(37);
    expect(result.end).toBe(37);
    expect(result.start).toBeLessThanOrEqual(result.end);
    expect(result.start).toBeLessThanOrEqual(37);
    expect(result.end).toBeLessThanOrEqual(37);
    // Spacers plus the rendered slice must account for every row exactly once.
    expect((result.topSpacer + result.bottomSpacer) / 29 + (result.end - result.start)).toBe(37);
  });
});
