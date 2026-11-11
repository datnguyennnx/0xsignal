/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import {
  DEPTH_BAR_TRANSITION,
  HANDOFF_FADE_CLASS,
  emptySideNotice,
  withDepthTransition,
} from "../utils/orderbook-depth-view";

describe("emptySideNotice", () => {
  test("names the side that has no levels", () => {
    expect(emptySideNotice("ask", 0)).toBe("No ask levels");
    expect(emptySideNotice("bid", 0)).toBe("No bid levels");
  });

  test("stays silent while the side still has levels", () => {
    expect(emptySideNotice("ask", 3)).toBeNull();
    expect(emptySideNotice("bid", 1)).toBeNull();
  });
});

describe("skeleton to book handoff", () => {
  test("entry fade runs at the fast token and yields to reduced motion", () => {
    expect(HANDOFF_FADE_CLASS).toContain("fade-in-0");
    expect(HANDOFF_FADE_CLASS).toContain("duration-(--dur-fast)");
    expect(HANDOFF_FADE_CLASS).toContain("motion-reduce:animate-none");
  });

  test("depth bars transition transform only, through the motion tokens", () => {
    expect(DEPTH_BAR_TRANSITION).toBe("transform var(--dur-fast) var(--ease-out)");
  });

  test("depth transition is added without mutating the cached base style", () => {
    const base = { transform: "scaleX(0.5)", transformOrigin: "right center" };
    expect(withDepthTransition(base)).toEqual({
      ...base,
      transition: DEPTH_BAR_TRANSITION,
    });
    expect(base).not.toHaveProperty("transition");
  });
});
