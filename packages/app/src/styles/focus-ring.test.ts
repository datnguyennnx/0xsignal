/// <reference types="bun-types" />
/**
 * One focus indicator, one geometry.
 *
 * Every control paints the same 2px accent line hugging its own shape. These
 * source-level assertions keep the definition in `utilities.css` from drifting
 * back into per-component copies and keep the forced-colors path intact.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const UTILITIES = source("./utilities.css");
const SEMANTIC = source("./tokens.semantic.css");
const MATERIAL = source("./tokens.material.css");
const A11Y = source("./a11y.css");

const lightBlock = SEMANTIC.slice(0, SEMANTIC.indexOf(".dark {"));

const toLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const oklchToSrgb = (l: number, c: number, hDeg: number): [number, number, number] => {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;
  const lm = lPrime ** 3;
  const mm = mPrime ** 3;
  const sm = sPrime ** 3;
  const encode = (channel: number) => {
    const v = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, v));
  };
  return [
    4.0767416621 * lm - 3.3077115913 * mm + 0.2309699292 * sm,
    -1.2684380046 * lm + 2.6097574011 * mm - 0.3413193965 * sm,
    -0.0041960863 * lm - 0.7034186147 * mm + 1.707614701 * sm,
  ].map(encode) as [number, number, number];
};

const luminance = (srgb: readonly number[]) =>
  0.2126 * toLinear(srgb[0]) + 0.7152 * toLinear(srgb[1]) + 0.0722 * toLinear(srgb[2]);

const colorOver = (fg: readonly number[], bg: readonly number[], alpha: number) =>
  fg.map((channel, i) => alpha * channel + (1 - alpha) * bg[i]);

/** Alpha compositing in linear light: browsers may mix here, not in sRGB. */
const colorOverLinear = (fg: readonly number[], bg: readonly number[], alpha: number) =>
  fg.map((channel, i) => {
    const mixed = alpha * toLinear(channel) + (1 - alpha) * toLinear(bg[i]);
    return mixed <= 0.0031308 ? 12.92 * mixed : 1.055 * mixed ** (1 / 2.4) - 0.055;
  });

const contrast = (a: readonly number[], b: readonly number[]) => {
  const ya = luminance(a);
  const yb = luminance(b);
  const hi = Math.max(ya, yb);
  const lo = Math.min(ya, yb);
  return (hi + 0.05) / (lo + 0.05);
};

const parseOklch = (text: string, name: string) => {
  const match = text.match(new RegExp(`${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`));
  if (match === null) throw new Error(`missing ${name}`);
  return oklchToSrgb(Number(match[1]), Number(match[2]), Number(match[3]));
};

const lightRing = lightBlock.match(
  /--ring:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\/\s*([\d.]+)\)/,
);

const ringSrgb = lightRing
  ? oklchToSrgb(Number(lightRing[1]), Number(lightRing[2]), Number(lightRing[3]))
  : null;
const ringAlpha = lightRing ? Number(lightRing[4]) : 0;

const COMPONENTS = {
  input: source("../components/ui/input.tsx"),
  "native-select": source("../components/ui/native-select.tsx"),
  button: source("../components/ui/button.tsx"),
  badge: source("../components/ui/badge.tsx"),
  checkbox: source("../components/ui/checkbox.tsx"),
  slider: source("../components/ui/slider.tsx"),
  tabs: source("../components/ui/tabs.tsx"),
  segmented: source("../components/ui/segmented.tsx"),
  "param-field": source("../features/chart/components/param-field.tsx"),
  "month-day-cell": source("../features/calendar/components/month-day-cell.tsx"),
} as const;

describe("focus tokens", () => {
  test("width, offset and colour are declared once in the semantic layer", () => {
    expect(SEMANTIC).toContain("--focus-width: 2px");
    expect(SEMANTIC).toContain("--focus-offset: 0px");
    expect(SEMANTIC).toContain("--focus-color: var(--ring)");
  });

  test("the accent keeps WCAG 2.4.11 contrast", () => {
    const ringValues = [...SEMANTIC.matchAll(/--ring:\s*oklch\([^)]*\/\s*([\d.]+)\)/g)];
    expect(ringValues.length).toBeGreaterThan(0);
    for (const match of ringValues) expect(Number(match[1])).toBeGreaterThanOrEqual(0.85);
  });

  test("the light ring stays at least 3:1 on its worst surface", () => {
    expect(ringSrgb).not.toBeNull();
    if (ringSrgb === null) return;
    const surfaces = ["--surface-base", "--surface-canvas", "--surface-raised"];
    const models = [
      { model: "sRGB", over: colorOver },
      { model: "linear-light", over: colorOverLinear },
    ] as const;
    for (const { model, over } of models) {
      for (const name of surfaces) {
        const surface = parseOklch(lightBlock, name);
        const composite = over(ringSrgb, surface, ringAlpha);
        expect({ name, model, contrast: contrast(composite, surface) >= 3 }).toEqual({
          name,
          model,
          contrast: true,
        });
      }
    }
  });

  test("the focus width is 2px in both themes", () => {
    expect(lightBlock).toContain("--focus-width: 2px");
    const darkBlock = SEMANTIC.slice(SEMANTIC.indexOf(".dark {"));
    expect(darkBlock).not.toContain("--focus-width");
  });
});

describe("one focus utility", () => {
  test("the outline is token-driven with no gap literal", () => {
    expect(UTILITIES).toContain("outline: var(--focus-width) solid var(--focus-color)");
    expect(UTILITIES).toContain("outline-offset: var(--focus-offset)");
    expect(UTILITIES).not.toMatch(/outline-offset:\s*-?2px/);
    expect(UTILITIES).toContain("outline-offset: calc(-1 * var(--focus-width))");
  });
});

describe("no duplicated focus geometry", () => {
  test("no component recolours its border on focus", () => {
    for (const [name, src] of Object.entries(COMPONENTS)) {
      expect({ name, hasBorderRing: src.includes("focus-visible:border-ring") }).toEqual({
        name,
        hasBorderRing: false,
      });
    }
  });

  test("every component references the canonical utility", () => {
    for (const [name, src] of Object.entries(COMPONENTS)) {
      expect({ name, hasFocusRing: src.includes("focus-ring") }).toEqual({
        name,
        hasFocusRing: true,
      });
    }
  });

  test("every component drops hand-written outline pairs", () => {
    for (const [name, src] of Object.entries(COMPONENTS)) {
      expect({ name, handWritten: src.includes("outline-2 outline-offset-2") }).toEqual({
        name,
        handWritten: false,
      });
    }
  });

  test("the slider thumb has no permanent border ring and no hover ring", () => {
    expect(COMPONENTS.slider).not.toContain("border-ring");
    expect(COMPONENTS.slider).not.toContain("ring-3");
    expect(COMPONENTS.slider).not.toContain("ring-4");
  });

  test("today yields its ring to focus", () => {
    expect(COMPONENTS["month-day-cell"]).toContain("today-ring");
    expect(COMPONENTS["month-day-cell"]).not.toContain("data-[state=today]:ring-1");
  });

  test("the retired control shadow is gone and controls do not stack it", () => {
    expect(MATERIAL).not.toContain("--control-shadow");
    for (const name of ["input", "native-select"] as const) {
      expect({ name, stacksRim: COMPONENTS[name].includes("--control-shadow") }).toEqual({
        name,
        stacksRim: false,
      });
    }
  });
});

describe("forced colors", () => {
  test("the system-colour block still applies to a solid outline", () => {
    expect(A11Y).toContain("@media (forced-colors: active)");
    expect(A11Y).toContain("CanvasText");
    expect(UTILITIES).toContain("outline: var(--focus-width) solid var(--focus-color)");
  });

  test("the contrast preference block still exists", () => {
    expect(A11Y).toContain("@media (prefers-contrast: more)");
  });
});
