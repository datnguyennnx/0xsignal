/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { ERROR_QUIPS, pickErrorQuip } from "./error-quips";

const EMOJI = /\p{Extended_Pictographic}/u;

describe("ERROR_QUIPS", () => {
  test("holds eight lines", () => {
    expect(ERROR_QUIPS).toHaveLength(8);
  });

  test("keeps every line on one short, calm line", () => {
    for (const quip of ERROR_QUIPS) {
      expect(quip.length).toBeLessThanOrEqual(78);
    }
  });

  test("stays dry: no exclamation marks and no emoji", () => {
    for (const quip of ERROR_QUIPS) {
      expect(quip).not.toContain("!");
      expect(quip).not.toMatch(EMOJI);
    }
  });
});

describe("pickErrorQuip", () => {
  test("returns a pool member across the usable range", () => {
    for (const value of [0, 0.5, 0.999]) {
      expect(ERROR_QUIPS).toContain(pickErrorQuip(() => value));
    }
  });

  test("clamps out-of-range and non-finite values instead of crashing", () => {
    for (const value of [1, -1, Number.NaN]) {
      expect(ERROR_QUIPS).toContain(pickErrorQuip(() => value));
    }
  });

  test("maps the same value to the same line", () => {
    expect(pickErrorQuip(() => 0.42)).toBe(pickErrorQuip(() => 0.42));
  });
});
