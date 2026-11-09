/// <reference types="bun-types" />
/**
 * Source-level glass-rendering contract.
 *
 * These rules keep compositor cost down: no backdrop blur on the sticky scroll
 * edge, a capped blur radius, and no transform animation on a backdrop-filter
 * element. There is no DOM harness in this package, so assert the CSS/TSX text.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const UTILITIES = source("./utilities.css");
const TOKENS = source("./tokens.material.css");
const PREFERENCES = source("./preferences.css");
const DIALOG = source("../components/ui/dialog.tsx");
const DROPDOWN = source("../components/ui/dropdown-menu.tsx");
const TOOLTIP = source("../components/ui/tooltip.tsx");

/** All values assigned to `name` via `calc(<n>px ...)` across both themes. */
function calcPxValues(css: string, name: string): number[] {
  const pattern = new RegExp(`${name}:\\s*calc\\((\\d+)px`, "g");
  return [...css.matchAll(pattern)].map((match) => Number(match[1]));
}

describe("scroll edge", () => {
  test("fades with a gradient fill instead of a backdrop blur", () => {
    const start = UTILITIES.indexOf(".scroll-edge::before");
    expect(start).toBeGreaterThan(-1);
    const block = UTILITIES.slice(start, UTILITIES.indexOf("}", start));

    expect(block).not.toContain("backdrop-filter");
    expect(block).not.toContain("blur(");
    expect(block).toContain("background: var(--scroll-edge-fill)");
  });

  test("the fill fades from the surface color", () => {
    expect(TOKENS).toContain(
      "--scroll-edge-fill: linear-gradient(to bottom, var(--surface-base) 0%, transparent 100%)",
    );
  });
});

describe("glass blur radius", () => {
  test("regular blur never exceeds 20px in either theme", () => {
    const values = calcPxValues(TOKENS, "--glass-blur");
    expect(values).toHaveLength(2);
    for (const value of values) expect(value).toBeLessThanOrEqual(20);
  });

  test("heavy blur never exceeds 24px in either theme", () => {
    const values = calcPxValues(TOKENS, "--glass-blur-heavy");
    expect(values).toHaveLength(2);
    for (const value of values) expect(value).toBeLessThanOrEqual(24);
  });
});

describe("data-glass scale", () => {
  test("the heaviest preference stays at or below 1.1x", () => {
    const blocks = PREFERENCES.match(/html\[data-glass="[^"]+"\]\s*\{[^}]*\}/g) ?? [];
    const scales = blocks
      .map((block) => /--glass-blur-k:\s*([\d.]+)/.exec(block)?.[1])
      .filter((value): value is string => value !== undefined)
      .map(Number);

    expect(scales).toEqual([0.55, 1, 1.1]);
    for (const scale of scales) expect(scale).toBeLessThanOrEqual(1.1);
  });
});

describe("glass element motion", () => {
  const cases = [
    { name: "dialog", src: DIALOG, slot: 'data-slot="dialog-content"' },
    { name: "dropdown", src: DROPDOWN, slot: 'data-slot="dropdown-menu-content"' },
    { name: "tooltip", src: TOOLTIP, slot: 'data-slot="tooltip-content"' },
  ] as const;

  for (const { name, src, slot } of cases) {
    test(`${name} glass shell fades without a transform`, () => {
      expect(src).toContain(slot);
      expect(src).not.toMatch(/zoom-(in|out)-95/);
      expect(src).not.toContain("origin-(--transform-origin)");
    });
  }
});
