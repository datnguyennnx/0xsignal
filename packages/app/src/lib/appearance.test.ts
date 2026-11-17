/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import {
  AMBIENT_PRESET_INTENSITY,
  DEFAULT_APPEARANCE,
  GLASS_PRESET_KNOBS,
  appearanceCssVars,
  applyAppearance,
  sanitizeAppearance,
  type AppearancePrefs,
} from "./appearance";

const prefsWith = (patch: Partial<AppearancePrefs>): AppearancePrefs =>
  sanitizeAppearance({ ...DEFAULT_APPEARANCE, ...patch });

describe("sanitizeAppearance", () => {
  test("clamps every numeric knob to its range", () => {
    const prefs = sanitizeAppearance({
      glass: "clear",
      glassAlpha: 9,
      glassBlur: -3,
      glassEdge: 5,
      glassSaturate: 0,
      glassBrightness: 9,
      ambientIntensity: -1,
      noise: 9,
    });

    expect(prefs.glassAlpha).toBe(1.6);
    expect(prefs.glassBlur).toBe(0);
    expect(prefs.glassEdge).toBe(1.6);
    expect(prefs.glassSaturate).toBe(0.8);
    expect(prefs.glassBrightness).toBe(1.12);
    expect(prefs.ambientIntensity).toBe(0);
    expect(prefs.noise).toBe(1.5);
  });

  test("falls back to the preset knobs when a numeric is missing or not finite", () => {
    const prefs = sanitizeAppearance({
      glass: "frosted",
      ambient: "vivid",
      glassAlpha: Number.NaN,
      glassBlur: "wide" as unknown as number,
    });

    expect(prefs.glassAlpha).toBe(GLASS_PRESET_KNOBS.frosted.alpha);
    expect(prefs.glassBlur).toBe(GLASS_PRESET_KNOBS.frosted.blur);
    expect(prefs.ambientIntensity).toBe(AMBIENT_PRESET_INTENSITY.vivid);
    expect(prefs.noise).toBe(DEFAULT_APPEARANCE.noise);
  });
});

describe("presets map to numeric knobs", () => {
  test("glass presets set alpha, blur, edge, saturate and brightness", () => {
    const cases = [
      { glass: "clear", knobs: GLASS_PRESET_KNOBS.clear },
      { glass: "balanced", knobs: GLASS_PRESET_KNOBS.balanced },
      { glass: "frosted", knobs: GLASS_PRESET_KNOBS.frosted },
    ] as const;

    for (const { glass, knobs } of cases) {
      const prefs = sanitizeAppearance({ glass });
      expect(prefs.glassAlpha).toBe(knobs.alpha);
      expect(prefs.glassBlur).toBe(knobs.blur);
      expect(prefs.glassEdge).toBe(knobs.edge);
      expect(prefs.glassSaturate).toBe(knobs.saturate);
      expect(prefs.glassBrightness).toBe(knobs.brightness);
    }
  });

  test("ambient presets set the intensity", () => {
    expect(sanitizeAppearance({ ambient: "off" }).ambientIntensity).toBe(0);
    expect(sanitizeAppearance({ ambient: "subtle" }).ambientIntensity).toBe(0.55);
    expect(sanitizeAppearance({ ambient: "vivid" }).ambientIntensity).toBe(1.25);
  });

  test("keeps the documented preset values", () => {
    expect(GLASS_PRESET_KNOBS.clear).toEqual({
      alpha: 0.72,
      blur: 0.55,
      edge: 0.8,
      saturate: 0.9,
      brightness: 0.98,
    });
    expect(GLASS_PRESET_KNOBS.frosted).toEqual({
      alpha: 1.18,
      blur: 1.1,
      edge: 1.15,
      saturate: 1.1,
      brightness: 1.02,
    });
  });
});

describe("migration from preset-only state", () => {
  test("fills numerics from the persisted presets", () => {
    const v2State = {
      glass: "frosted",
      ambient: "vivid",
      density: "compact",
      uiScale: "large",
      radius: "round",
      marketColors: "swapped",
    } as const;

    expect(sanitizeAppearance(v2State)).toEqual({
      ...v2State,
      glassAlpha: 1.18,
      glassBlur: 1.1,
      glassEdge: 1.15,
      glassSaturate: 1.1,
      glassBrightness: 1.02,
      ambientIntensity: 1.25,
      noise: DEFAULT_APPEARANCE.noise,
    });
  });
});

describe("applyAppearance", () => {
  const fakeRoot = () => {
    const vars: Record<string, string> = {};
    return {
      vars,
      element: {
        dataset: {} as Record<string, string>,
        style: {
          setProperty: (name: string, value: string) => {
            vars[name] = value;
          },
        },
      },
    };
  };

  test("appearanceCssVars maps every knob to its custom property", () => {
    const prefs = prefsWith({
      glassAlpha: 0.72,
      glassBlur: 0.55,
      glassEdge: 0.8,
      glassSaturate: 0.9,
      glassBrightness: 0.98,
      ambientIntensity: 0.55,
      noise: 0.4,
    });

    expect(appearanceCssVars(prefs)).toEqual({
      "--glass-alpha-k": "0.72",
      "--glass-blur-k": "0.55",
      "--glass-edge-k": "0.8",
      "--glass-sat-k": "0.9",
      "--glass-bright-k": "0.98",
      "--ambient-k": "0.55",
      "--noise-a": "0.4",
    });
  });

  test("always writes the inline vars, even at defaults", () => {
    const { vars, element } = fakeRoot();
    const previousDocument = Reflect.get(globalThis, "document");
    Reflect.set(globalThis, "document", { documentElement: element });

    try {
      applyAppearance(DEFAULT_APPEARANCE);
    } finally {
      Reflect.set(globalThis, "document", previousDocument);
    }

    expect(vars).toEqual(appearanceCssVars(DEFAULT_APPEARANCE));
    expect(element.dataset.glass).toBe(DEFAULT_APPEARANCE.glass);
    expect(element.dataset.ambient).toBe(DEFAULT_APPEARANCE.ambient);
    expect(element.dataset.uiScale).toBeUndefined();
  });
});
