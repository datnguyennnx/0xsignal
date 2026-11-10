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
const SEMANTIC = source("./tokens.semantic.css");
const COMPAT = source("./compat.css");
const PREFERENCES = source("./preferences.css");
const DIALOG = source("../components/ui/dialog.tsx");
const DROPDOWN = source("../components/ui/dropdown-menu.tsx");
const TOOLTIP = source("../components/ui/tooltip.tsx");

/** All values assigned to `name` via `calc(<n>px ...)` across both themes. */
function calcPxValues(css: string, name: string): number[] {
  const pattern = new RegExp(`${name}:\\s*calc\\((\\d+)px`, "g");
  return [...css.matchAll(pattern)].map((match) => Number(match[1]));
}

describe("one paint, one owner", () => {
  test("duplicate layer tokens are deleted", () => {
    expect(TOKENS).not.toContain("--shadow-e4");
    expect(SEMANTIC).not.toContain("--border-strong");
    expect(COMPAT).not.toContain("--radius:");
  });

  test("the material layer aliases the semantic layer instead of redeclaring", () => {
    expect(TOKENS.match(/--layer-content-edge: var\(--border-subtle\)/g)).toHaveLength(2);
    expect(TOKENS.match(/--layer-content-fill: var\(--surface-base\)/g)).toHaveLength(2);
    expect(TOKENS.match(/--layer-raised-fill: var\(--surface-raised\)/g)).toHaveLength(2);
    expect(TOKENS.match(/--glass-fallback-fill: var\(--surface-overlay\)/g)).toHaveLength(2);
  });
});

describe("rim family", () => {
  test("exactly three canonical rim tokens", () => {
    const names = [...TOKENS.matchAll(/--rim-[a-z-]+(?=\s*:)/g)].map((match) => match[0]);
    expect([...new Set(names)].sort()).toEqual(["--rim-accent", "--rim-line", "--rim-specular"]);
  });

  test("the neutral ring is referenced, not re-declared", () => {
    expect(UTILITIES).not.toContain("inset 0 0 0 1px var(--border)");
    expect(UTILITIES).toContain("var(--rim-line)");
  });
});

describe("tier identity", () => {
  test("identity is declared after the glass @supports block", () => {
    const supports = UTILITIES.indexOf("@supports ((backdrop-filter");
    const identity = UTILITIES.indexOf(".tier-identity");
    expect(supports).toBeGreaterThan(-1);
    expect(identity).toBeGreaterThan(supports);
  });
});

describe("glass specular blur", () => {
  test("specular tracks --glass-blur and no site hardcodes 24px", () => {
    expect(UTILITIES.match(/var\(--glass-specular-blur\)/g)).toHaveLength(4);
    expect(UTILITIES).not.toContain("inset 0 0 24px -6px");
  });
});

describe("glass radius", () => {
  test("glass pins a radius unless the component set one", () => {
    expect(TOKENS).toContain("--glass-radius: var(--radius-overlay)");
    expect(UTILITIES).toContain('.tier-floating[data-material="glass"]:not([data-radius])');
    expect(UTILITIES).toContain("border-radius: var(--glass-radius)");
  });
});

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
