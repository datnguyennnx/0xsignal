/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { effectiveDelta, findScrollParent, resolveAutoScrollVelocity } from "./resize-auto-scroll";

describe("resolveAutoScrollVelocity", () => {
  test("a pointer in the bottom band scrolls down", () => {
    expect(resolveAutoScrollVelocity(600, 0, 620)).toBeGreaterThan(0);
  });

  test("a pointer between the bands does not scroll", () => {
    expect(resolveAutoScrollVelocity(300, 0, 620)).toBe(0);
  });

  test("a pointer in the top band scrolls up", () => {
    expect(resolveAutoScrollVelocity(10, 0, 620)).toBeLessThan(0);
  });

  test("the magnitude never exceeds the maximum", () => {
    for (let y = -200; y <= 800; y += 7) {
      expect(Math.abs(resolveAutoScrollVelocity(y, 0, 620))).toBeLessThanOrEqual(18);
    }
  });

  test("the default maximum is reached at the edge", () => {
    expect(resolveAutoScrollVelocity(620, 0, 620)).toBe(18);
    expect(resolveAutoScrollVelocity(0, 0, 620)).toBe(-18);
  });

  test("the ramp is linear inside a band", () => {
    expect(resolveAutoScrollVelocity(620, 0, 620)).toBe(18);
    expect(resolveAutoScrollVelocity(620 - 12, 0, 620)).toBe(13.5);
    expect(resolveAutoScrollVelocity(620 - 24, 0, 620)).toBe(9);
    expect(resolveAutoScrollVelocity(620 - 36, 0, 620)).toBe(4.5);
  });

  test("an explicit smaller maximum still clamps", () => {
    expect(resolveAutoScrollVelocity(620, 0, 620, 48, 3)).toBe(3);
  });
});

describe("findScrollParent", () => {
  test("returns null when there is no element to walk from", () => {
    expect(findScrollParent(null)).toBeNull();
  });
});

describe("effectiveDelta", () => {
  test("a held pointer grows the delta while the content scrolls under it", () => {
    expect(effectiveDelta(100, 100, 0, 0, 40)).toBe(0);
    expect(effectiveDelta(100, 100, 120, 0, 40)).toBe(3);
  });

  test("equals the pointer delta when scrollTop is unchanged", () => {
    expect(effectiveDelta(180, 100, 50, 50, 40)).toBe(effectiveDelta(180, 100, 0, 0, 40));
    expect(effectiveDelta(180, 100, 50, 50, 40)).toBe(2);
  });

  test("a pitch below one is treated as one", () => {
    expect(effectiveDelta(10, 0, 0, 0, 0)).toBe(10);
  });
});
