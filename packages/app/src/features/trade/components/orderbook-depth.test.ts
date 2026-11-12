/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { emptySideNotice, withDepthTransition } from "../utils/orderbook-depth-view";

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

describe("depth transition", () => {
  test("depth transition is added without mutating the cached base style", () => {
    const base = { transform: "scaleX(0.5)", transformOrigin: "right center" };
    const styled = withDepthTransition(base);
    expect(styled).toMatchObject(base);
    expect(styled.transition).toContain("transform");
    expect(base).not.toHaveProperty("transition");
  });
});
