/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import {
  alphaComposite,
  contrastRatio,
  parseCssColor,
  worstBackdrop,
  worstContrast,
  type Rgba,
} from "./contrast";

const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };

describe("parseCssColor", () => {
  test("oklch extremes resolve to white and black", () => {
    expect(parseCssColor("oklch(1 0 0)")).toEqual(white);
    expect(parseCssColor("oklch(0 0 0)")).toEqual(black);
  });

  test("oklch alpha and rgb/hex forms parse", () => {
    expect(parseCssColor("oklch(0 0 0 / 0.5)")).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(parseCssColor("rgb(10 20 30 / 0.25)")).toEqual({ r: 10, g: 20, b: 30, a: 0.25 });
    expect(parseCssColor("#fff")).toEqual(white);
  });

  test("unparseable input returns null", () => {
    expect(parseCssColor("var(--app-bg)")).toBeNull();
    expect(parseCssColor("not-a-colour")).toBeNull();
  });
});

describe("contrastRatio", () => {
  test("white against black is 21:1 in both directions", () => {
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
  });

  test("the same colour is 1:1", () => {
    const grey = parseCssColor("oklch(0.6 0.02 250)")!;
    expect(contrastRatio(grey, grey)).toBeCloseTo(1, 10);
  });

  test("a translucent foreground is flattened onto the background", () => {
    const translucent = parseCssColor("oklch(0 0 0 / 0.5)")!;
    expect(contrastRatio(translucent, white)).toBeCloseTo(
      contrastRatio({ r: 127.5, g: 127.5, b: 127.5, a: 1 }, white),
      10,
    );
  });
});

describe("alphaComposite", () => {
  test("blends in stored gamma space and returns an opaque result", () => {
    const painted = alphaComposite({ r: 0, g: 0, b: 0, a: 0.5 }, white);
    expect(painted.r).toBeCloseTo(127.5, 10);
    expect(painted.g).toBeCloseTo(127.5, 10);
    expect(painted.b).toBeCloseTo(127.5, 10);
    expect(painted.a).toBe(1);
  });

  test("sanity: half black over white sits near 3.98:1", () => {
    const painted = alphaComposite({ r: 0, g: 0, b: 0, a: 0.5 }, white);
    expect(contrastRatio(painted, white)).toBeCloseTo(3.98, 2);
  });

  test("a fully opaque top ignores the bottom", () => {
    expect(alphaComposite(black, white)).toEqual(black);
  });
});

describe("worstBackdrop", () => {
  test("picks the backdrop with the lowest ratio", () => {
    const worst = worstBackdrop(white, [black, white]);
    expect(worst?.backdrop).toEqual(white);
    expect(worst?.ratio).toBeCloseTo(1, 10);
    expect(worstContrast(white, [black, white])).toBeCloseTo(1, 10);
  });

  test("an empty backdrop list yields no composite and an infinite ratio", () => {
    expect(worstBackdrop(white, [])).toBeNull();
    expect(worstContrast(white, [])).toBe(Number.POSITIVE_INFINITY);
  });
});
