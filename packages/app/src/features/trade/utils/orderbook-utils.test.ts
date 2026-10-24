import { describe, expect, test } from "bun:test";

import { levelsPerHalf } from "./orderbook-utils";

describe("levelsPerHalf", () => {
  const cases: Array<[bodyHeightPx: number, rowHeightPx: number, expected: number, note: string]> =
    [
      [0, 24, 0, "zero height"],
      [-1, 24, 0, "negative height"],
      [Number.NaN, 24, 0, "NaN height"],
      [Number.POSITIVE_INFINITY, 24, 0, "infinite height"],
      [71, 24, 0, "one pixel short of the spread plus a row per side"],
      [72, 24, 1, "exactly one row per side plus the spread"],
      [119, 24, 1, "just under two rows per side"],
      [120, 24, 2, "two rows per side"],
      [680, 24, 13, "656px split across both halves"],
      [1112, 24, 22, "a tall panel"],
      [680, 36, 8, "4K rows in a 680px body"],
      [1112, 36, 14, "4K rows in a tall panel"],
      [108, 36, 1, "exactly one 36px row per side plus the spread"],
      [107, 36, 0, "one pixel short of a 36px row per side"],
      [680, 0, 0, "zero row height"],
    ];

  for (const [bodyHeightPx, rowHeightPx, expected, note] of cases) {
    test(`${bodyHeightPx}px body / ${rowHeightPx}px row -> ${expected} (${note})`, () => {
      expect(levelsPerHalf(bodyHeightPx, rowHeightPx)).toBe(expected);
    });
  }

  for (const rowHeightPx of [24, 36]) {
    test(`row=${rowHeightPx}: never decreases with height and never exceeds floor(height / (2 * row))`, () => {
      let previous = 0;

      for (let bodyHeightPx = 1; bodyHeightPx <= 2000; bodyHeightPx += 1) {
        const result = levelsPerHalf(bodyHeightPx, rowHeightPx);

        expect(result).toBeGreaterThanOrEqual(previous);
        expect(result).toBeLessThanOrEqual(Math.floor(bodyHeightPx / (2 * rowHeightPx)));

        previous = result;
      }
    });
  }
});
