/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import {
  assertSurfacePlacement,
  DEFAULT_MATERIAL,
  isMaterialFor,
  surfaceAttrs,
  type SurfaceAttrsInput,
  type SurfaceFrame,
  type Tier,
} from "./tiers";
import type { SurfaceProps } from "./surface";

describe("DEFAULT_MATERIAL", () => {
  test("solid paints a frost layer", () => {
    expect(DEFAULT_MATERIAL.solid).toEqual({ material: "frost" });
  });

  test("content paints an opaque plate", () => {
    expect(DEFAULT_MATERIAL.content).toEqual({ material: "plate" });
  });

  test("control paints thin glass", () => {
    expect(DEFAULT_MATERIAL.control).toEqual({ material: "glass", thickness: "thin" });
  });

  test("floating paints regular glass", () => {
    expect(DEFAULT_MATERIAL.floating).toEqual({ material: "glass", thickness: "regular" });
  });

  test("scrim paints no material and carries no thickness", () => {
    expect(DEFAULT_MATERIAL.scrim.material).toBe("none");
    expect(DEFAULT_MATERIAL.scrim.thickness).toBeUndefined();
  });

  test("content and solid never resolve to glass", () => {
    for (const tier of ["solid", "content"] as const) {
      expect(DEFAULT_MATERIAL[tier].material).not.toBe("glass");
      expect(surfaceAttrs({ tier })["data-material"]).not.toBe("glass");
      expect(isMaterialFor(tier, "glass")).toBe(false);
      expect(isMaterialFor(tier, DEFAULT_MATERIAL[tier].material)).toBe(true);
    }
  });

  test("content and solid accept frost and solid", () => {
    for (const tier of ["solid", "content"] as const) {
      expect(isMaterialFor(tier, "frost")).toBe(true);
      expect(isMaterialFor(tier, "solid")).toBe(true);
      expect(isMaterialFor(tier, "plate")).toBe(true);
      expect(surfaceAttrs({ tier, material: "solid" })["data-material"]).toBe("solid");
    }
  });
});

describe("SurfaceAttrsInput", () => {
  test("content and solid reject glass at the type level", () => {
    // @ts-expect-error glass is not a legal content material
    const content: SurfaceAttrsInput = { tier: "content", material: "glass" };
    // @ts-expect-error glass is not a legal solid material
    const solid: SurfaceAttrsInput = { tier: "solid", material: "glass" };
    // @ts-expect-error glass is not a legal content material
    const surface: SurfaceProps = { tier: "content", material: "glass" };
    const frost: SurfaceAttrsInput = { tier: "content", material: "frost" };
    expect([content, solid, surface, frost]).toHaveLength(4);
  });

  test("clamps an illegal material forced past the types", () => {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion
    const forced = { tier: "content", material: "glass" } as unknown as SurfaceAttrsInput;
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
    expect(surfaceAttrs({ tier: "control", thickness: "thick" })["data-thickness"]).toBe("thick");
  });

  test("omits depth when undefined and keeps an explicit zero", () => {
    expect(surfaceAttrs({ tier: "floating" })).not.toHaveProperty("data-glass-depth");
    expect(surfaceAttrs({ tier: "floating", depth: 0 })["data-glass-depth"]).toBe(0);
  });

  test("only control and floating default to glass", () => {
    const tiers: readonly Tier[] = ["solid", "content", "control", "floating", "scrim"];
    const glass = tiers.filter((tier) => surfaceAttrs({ tier })["data-material"] === "glass");
    expect(glass).toEqual(["control", "floating"]);
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
