/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { computeResizeFrame } from "./resize-math";
import type { ResizeFrame, ResizeLimits } from "./types";

const DEFAULT_LIMITS: ResizeLimits = {
  minW: 1,
  minH: 1,
  minX: 0,
  maxX: 26,
  minY: 0,
  maxRows: 32,
};

function limits(overrides: Partial<ResizeLimits> = {}): ResizeLimits {
  return { ...DEFAULT_LIMITS, ...overrides };
}

function frame(x: number, y: number, w: number, h: number): ResizeFrame {
  return { x, y, w, h };
}

describe("computeResizeFrame south", () => {
  test("downward drag grows the panel", () => {
    const start = frame(0, 0, 16, 16);
    expect(computeResizeFrame("s", start, 0, 4, limits())).toEqual(frame(0, 0, 16, 20));
  });

  test("upward drag shrinks no further than minH", () => {
    const start = frame(0, 0, 16, 16);
    expect(computeResizeFrame("s", start, 0, -20, limits({ minH: 8 }))).toEqual(frame(0, 0, 16, 8));
  });

  test("growth is bounded by maxRows minus the panel top", () => {
    const start = frame(0, 0, 16, 16);
    expect(computeResizeFrame("s", start, 0, 60, limits({ maxRows: 512 }))).toEqual(
      frame(0, 0, 16, 76),
    );
  });

  test("a lower start row leaves less room below maxRows", () => {
    const start = frame(0, 20, 4, 4);
    expect(computeResizeFrame("s", start, 0, 40, limits())).toEqual(frame(0, 20, 4, 12));
  });
});

describe("computeResizeFrame north", () => {
  test("downward drag moves the top down and shrinks by the same rows", () => {
    const start = frame(0, 10, 16, 10);
    expect(computeResizeFrame("n", start, 0, 2, limits())).toEqual(frame(0, 12, 16, 8));
  });

  test("upward drag grows the panel", () => {
    const start = frame(0, 2, 16, 8);
    expect(computeResizeFrame("n", start, 0, -5, limits())).toEqual(frame(0, 0, 16, 10));
  });

  test("the top edge cannot cross minY", () => {
    const start = frame(0, 2, 16, 8);
    expect(computeResizeFrame("n", start, 0, -20, limits())).toEqual(frame(0, 0, 16, 10));
  });
});

describe("computeResizeFrame east and west", () => {
  test("east drag grows the width", () => {
    const start = frame(4, 0, 10, 5);
    expect(computeResizeFrame("e", start, 3, 0, limits())).toEqual(frame(4, 0, 13, 5));
  });

  test("east growth stops at maxX", () => {
    const start = frame(4, 0, 10, 5);
    expect(computeResizeFrame("e", start, 100, 0, limits())).toEqual(frame(4, 0, 22, 5));
  });

  test("west drag moves the left edge and keeps the right edge pinned", () => {
    const start = frame(4, 0, 10, 5);
    expect(computeResizeFrame("w", start, 2, 0, limits())).toEqual(frame(6, 0, 8, 5));
  });

  test("west growth stops at minX", () => {
    const start = frame(4, 0, 10, 5);
    expect(computeResizeFrame("w", start, -10, 0, limits())).toEqual(frame(0, 0, 14, 5));
  });
});
