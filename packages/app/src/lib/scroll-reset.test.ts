/// <reference types="bun-types" />
/**
 * Screen-switch scroll contract.
 *
 * `shouldResetScroll` is pure, so it is tested directly. The wiring in
 * MainLayout is pinned at the source level (no DOM harness here).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { shouldResetScroll } from "./scroll-reset";

const LAYOUT_SOURCE = readFileSync(new URL("../layouts/main-layout.tsx", import.meta.url), "utf8");

describe("shouldResetScroll", () => {
  test("the same pathname keeps the current offset", () => {
    expect(shouldResetScroll("/portfolio", "/portfolio")).toBe(false);
  });

  test("a different pathname starts at the top", () => {
    expect(shouldResetScroll("/portfolio", "/whales")).toBe(true);
  });
});

describe("MainLayout scroll wiring", () => {
  test("resets the scrolling main element before paint", () => {
    expect(LAYOUT_SOURCE).toContain("useLayoutEffect");
    expect(LAYOUT_SOURCE).toContain('mainRef.current?.scrollTo({ top: 0, behavior: "instant" })');
    expect(LAYOUT_SOURCE).toContain("[location.pathname]");
  });

  test("reserves the scrollbar gutter on the main element", () => {
    expect(LAYOUT_SOURCE).toContain("scrollbar-gutter-stable");
  });
});
