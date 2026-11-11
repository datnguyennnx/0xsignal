import { describe, expect, test } from "bun:test";

import { clampRowHeight, levelsPerHalf, makeFormatKey, rowsPerHalfFor } from "./orderbook-utils";

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

describe("rowsPerHalfFor", () => {
  test("sizes by the dense floor, so a tall panel keeps the protocol cap", () => {
    // 1148 = 20 rows * 2 * 28px + the 28px spread: exactly the cap at the floor.
    expect(rowsPerHalfFor(1148, 28)).toBe(20);
    expect(rowsPerHalfFor(2000, 28)).toBe(20);
  });

  test("never yields fewer rows as the panel grows", () => {
    for (let bodyHeightPx = 1; bodyHeightPx <= 2000; bodyHeightPx += 1) {
      expect(rowsPerHalfFor(bodyHeightPx + 500, 28)).toBeGreaterThanOrEqual(
        rowsPerHalfFor(bodyHeightPx, 28),
      );
    }
  });

  test("holds at zero until one floor row per side plus the spread fits", () => {
    expect(rowsPerHalfFor(83, 28)).toBe(0);
    expect(rowsPerHalfFor(84, 28)).toBe(1);
  });
});

describe("clampRowHeight", () => {
  const MIN = 28;
  const MAX = 40;

  test("short panel pins to the dense floor", () => {
    expect(clampRowHeight(200, 4, MIN, MAX)).toBe(MIN);
  });

  test("middle panel returns the exact quotient", () => {
    expect(clampRowHeight(300, 4, MIN, MAX)).toBe(37.5);
  });

  test("tall panel pins to the readability ceiling", () => {
    expect(clampRowHeight(2000, 20, MIN, MAX)).toBe(MAX);
  });

  test("zero or negative available height collapses to the floor", () => {
    expect(clampRowHeight(0, 5, MIN, MAX)).toBe(MIN);
    expect(clampRowHeight(-40, 5, MIN, MAX)).toBe(MIN);
  });

  test("no rows to stretch means no stretch", () => {
    expect(clampRowHeight(400, 0, MIN, MAX)).toBe(MIN);
  });

  test("strictly positive but sub-floor quotient clamps up", () => {
    expect(clampRowHeight(100, 8, MIN, MAX)).toBe(MIN);
  });

  test("non-integer quotient is preserved", () => {
    expect(clampRowHeight(273, 4, MIN, MAX)).toBeCloseTo(34.125, 10);
  });
});

describe("makeFormatKey", () => {
  test("distinct for prices that collide under toFixed(8)", () => {
    expect(makeFormatKey(0.000000001, 5)).not.toBe(makeFormatKey(0.000000002, 5));
  });

  test("identical for the same price and nSigFigs", () => {
    expect(makeFormatKey(74049, 5)).toBe(makeFormatKey(74049, 5));
  });

  test("differs when nSigFigs differs", () => {
    expect(makeFormatKey(74049, 5)).not.toBe(makeFormatKey(74049, 4));
  });

  test("twenty levels spaced by 1e-9 produce twenty distinct keys", () => {
    const base = 74049;
    const keys = Array.from({ length: 20 }, (_, index) => makeFormatKey(base + index * 1e-9, 5));

    expect(new Set(keys).size).toBe(20);
  });
});
