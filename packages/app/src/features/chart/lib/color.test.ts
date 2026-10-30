/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { toRgb, toRgba } from "./color";

describe("toRgb", () => {
  test("maps oklch white to hex", () => {
    expect(toRgb("oklch(1 0 0)")).toBe("#ffffff");
  });

  test("maps oklch black to hex", () => {
    expect(toRgb("oklch(0 0 0)")).toBe("#000000");
  });

  test("maps a known chromatic oklch to its exact rgb", () => {
    expect(toRgb("oklch(0.628 0.2577 29.23)")).toBe("#ff0000");
  });

  test("passes hex through unchanged", () => {
    expect(toRgb("#abc")).toBe("#abc");
    expect(toRgb("#aabbccdd")).toBe("#aabbccdd");
  });

  test("passes rgb()/rgba() through unchanged", () => {
    expect(toRgb("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
    expect(toRgb("rgba(1, 2, 3, 0.5)")).toBe("rgba(1, 2, 3, 0.5)");
  });

  test("falls back to the ink stand-in on invalid input", () => {
    expect(toRgb("color-mix(in srgb, red, blue)")).toBe("#636363");
    expect(toRgb("transparent")).toBe("#636363");
    expect(toRgb("oklch(0.5 abc 0)")).toBe("#636363");
    expect(toRgb("")).toBe("#636363");
  });

  test("preserves alpha from oklch tokens", () => {
    expect(toRgb("oklch(0.628 0.2577 29.23 / 0.15)")).toBe("rgba(255, 0, 0, 0.15)");
  });
});

describe("toRgba", () => {
  test("applies alpha to a hex color", () => {
    expect(toRgba("#0f0", 0.05)).toBe("rgba(0, 255, 0, 0.05)");
  });

  test("applies alpha to an oklch token", () => {
    expect(toRgba("oklch(0.628 0.2577 29.23)", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });
});
