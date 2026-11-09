/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./trade-dropdown-panel.tsx", import.meta.url), "utf8");

describe("trade dropdown panel virtualization", () => {
  test("the panel computes its window with the pure helper", () => {
    expect(source).toContain("computeWindow");
  });

  test("it renders a slice, never the full list map", () => {
    expect(source).toContain("rows.slice(");
    expect(source).not.toContain("formattedTrades");
    expect(source).not.toMatch(/[^A-Za-z]rows\.map\(/);
  });

  test("the scroll listener is passive and rAF-coalesced", () => {
    expect(source).toContain("{ passive: true }");
    expect(source).toContain("requestAnimationFrame");
  });
});
