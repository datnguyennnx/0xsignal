/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { assertSurfacePlacement, DEFAULT_MATERIAL, type SurfaceFrame } from "./tiers";

describe("DEFAULT_MATERIAL", () => {
  test("solid paints thick glass", () => {
    expect(DEFAULT_MATERIAL.solid).toEqual({ material: "glass", thickness: "thick" });
  });

  test("content paints regular glass", () => {
    expect(DEFAULT_MATERIAL.content).toEqual({ material: "glass", thickness: "regular" });
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
