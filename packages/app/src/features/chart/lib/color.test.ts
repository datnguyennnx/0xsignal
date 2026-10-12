import { describe, expect, test } from "bun:test";

import { toRgb, toRgba } from "./color";

describe("toRgb", () => {
  test("maps oklch white to hex", () => {
    expect(toRgb("oklch(1 0 0)")).toBe("#ffffff");
  });

  test("maps oklch black to hex", () => {
    expect(toRgb("oklch(0 0 0)")).toBe("#000000");
  });

  test("maps a mid oklch to a neutral grey", () => {
    expect(toRgb("oklch(0.5 0 0)")).toBe("#636363");
  });

  test("passes hex through unchanged", () => {
    expect(toRgb("#abc")).toBe("#abc");
    expect(toRgb("#aabbccdd")).toBe("#aabbccdd");
  });

  test("passes rgb()/rgba() through unchanged", () => {
    expect(toRgb("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
    expect(toRgb("rgba(1, 2, 3, 0.5)")).toBe("rgba(1, 2, 3, 0.5)");
  });

  test("falls back to #000 for anything else", () => {
    expect(toRgb("color-mix(in srgb, red, blue)")).toBe("#000");
    expect(toRgb("transparent")).toBe("#000");
    expect(toRgb("")).toBe("#000");
  });

  test("preserves alpha from oklch tokens", () => {
    expect(toRgb("oklch(0.58 0.19 145 / 0.15)")).toMatch(/^rgba\(\d+, \d+, \d+, 0\.15\)$/);
  });
});

describe("toRgba", () => {
  test("applies alpha to a hex color", () => {
    expect(toRgba("#0f0", 0.05)).toBe("rgba(0, 255, 0, 0.05)");
  });

  test("applies alpha to an oklch token", () => {
    expect(toRgba("oklch(0.6 0 0)", 0.5)).toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/);
  });
});
