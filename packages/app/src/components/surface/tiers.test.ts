/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import {
  assertSurfacePlacement,
  surfaceAttrs,
  type SurfaceAttrsInput,
  type SurfaceFrame,
  type Tier,
} from "./tiers";
import type { SurfaceProps } from "./surface";

type Expect<T extends true> = T;
type Rejected<T, U> = [T] extends [U] ? false : true;

/** A single deliberate breach of the per-tier contract, used to exercise the runtime clamp. */
function forceAttrs(value: unknown): SurfaceAttrsInput {
  return value as SurfaceAttrsInput;
}

describe("SurfaceAttrsInput", () => {
  test("content and solid reject glass at the type level", () => {
    const content: Expect<Rejected<{ tier: "content"; material: "glass" }, SurfaceAttrsInput>> =
      true;
    const solid: Expect<Rejected<{ tier: "solid"; material: "glass" }, SurfaceAttrsInput>> = true;
    const surface: Expect<Rejected<{ tier: "content"; material: "glass" }, SurfaceProps>> = true;
    const frost: SurfaceAttrsInput = { tier: "content", material: "frost" };
    expect([content, solid, surface, frost]).toHaveLength(4);
  });

  test("clamps an illegal material forced past the types", () => {
    const forced = forceAttrs({ tier: "content", material: "glass" });
    expect(() => surfaceAttrs(forced)).toThrow(/not allowed/);
  });
});

describe("surfaceAttrs", () => {
  test("emits the tier class and default material", () => {
    expect(surfaceAttrs({ tier: "floating" })).toEqual({
      "data-tier": "floating",
      "data-material": "glass",
      "data-thickness": "regular",
      className: "tier-floating",
    });
  });

  test("omits thickness unless the resolved material is glass", () => {
    const content = surfaceAttrs({ tier: "content" });
    expect(content).not.toHaveProperty("data-thickness");
    expect(surfaceAttrs({ tier: "content", material: "plate" })).not.toHaveProperty(
      "data-thickness",
    );
  });

  test("frost never carries thickness", () => {
    const content = surfaceAttrs({ tier: "content", material: "frost" });
    expect(content["data-material"]).toBe("frost");
    expect(content).not.toHaveProperty("data-thickness");
    expect(surfaceAttrs({ tier: "solid" })["data-material"]).toBe("frost");
  });

  test("emits the supplied glass thickness", () => {
    expect(surfaceAttrs({ tier: "floating", thickness: "thick" })["data-thickness"]).toBe("thick");
  });

  test("omits depth when undefined and keeps an explicit zero", () => {
    expect(surfaceAttrs({ tier: "floating" })).not.toHaveProperty("data-glass-depth");
    expect(surfaceAttrs({ tier: "floating", depth: 0 })["data-glass-depth"]).toBe(0);
  });

  test("only floating defaults to glass", () => {
    const tiers: readonly Tier[] = ["solid", "content", "control", "floating", "scrim"];
    const glass = tiers.filter((tier) => surfaceAttrs({ tier })["data-material"] === "glass");
    expect(glass).toEqual(["floating"]);
  });
});

describe("assertSurfacePlacement", () => {
  const glassAncestor: SurfaceFrame = { tier: "solid", owner: "app-shell" };

  test("a glass control nested inside a glass ancestor does not throw", () => {
    expect(() => {
      assertSurfacePlacement(
        { tier: "control", variant: "regular", overMedia: false, dim: false },
        [glassAncestor],
      );
    }).not.toThrow();
  });
});
