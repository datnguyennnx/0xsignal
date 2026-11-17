export const APPEARANCE_STORAGE_KEY = "0xsignal.appearance.v1";

export type GlassPreset = "clear" | "balanced" | "frosted";
export type AmbientPreset = "off" | "subtle" | "vivid";
export type DensityPreset = "compact" | "comfortable" | "spacious";
export type UiScalePreset = "small" | "default" | "large" | "xl";
export type RadiusPreset = "sharp" | "default" | "round";
export type MarketColorsPreset = "default" | "swapped" | "colorblind";

export type AppearanceNumericKey =
  | "glassAlpha"
  | "glassBlur"
  | "glassEdge"
  | "glassSaturate"
  | "glassBrightness"
  | "ambientIntensity"
  | "noise";

export type AppearanceNumerics = Record<AppearanceNumericKey, number>;

export interface AppearancePrefs extends AppearanceNumerics {
  glass: GlassPreset;
  ambient: AmbientPreset;
  density: DensityPreset;
  uiScale: UiScalePreset;
  radius: RadiusPreset;
  marketColors: MarketColorsPreset;
}

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  glass: "balanced",
  ambient: "subtle",
  density: "comfortable",
  uiScale: "default",
  radius: "default",
  marketColors: "default",
  glassAlpha: 1,
  glassBlur: 1,
  glassEdge: 1,
  glassSaturate: 1,
  glassBrightness: 1,
  ambientIntensity: 0.55,
  noise: 1,
};

interface GlassKnobs {
  alpha: number;
  blur: number;
  edge: number;
  saturate: number;
  brightness: number;
}

export const GLASS_PRESET_KNOBS: Record<GlassPreset, GlassKnobs> = {
  clear: { alpha: 0.72, blur: 0.55, edge: 0.8, saturate: 0.9, brightness: 0.98 },
  balanced: { alpha: 1, blur: 1, edge: 1, saturate: 1, brightness: 1 },
  frosted: { alpha: 1.18, blur: 1.1, edge: 1.15, saturate: 1.1, brightness: 1.02 },
};

export const AMBIENT_PRESET_INTENSITY: Record<AmbientPreset, number> = {
  off: 0,
  subtle: 0.55,
  vivid: 1.25,
};

interface NumericSpec {
  min: number;
  max: number;
}

const NUMERIC_SPEC: Record<AppearanceNumericKey, NumericSpec> = {
  glassAlpha: { min: 0.4, max: 1.6 },
  glassBlur: { min: 0, max: 2 },
  glassEdge: { min: 0, max: 1.6 },
  glassSaturate: { min: 0.8, max: 2 },
  glassBrightness: { min: 0.96, max: 1.12 },
  ambientIntensity: { min: 0, max: 1.5 },
  noise: { min: 0, max: 1.5 },
};

const GLASS: readonly GlassPreset[] = ["clear", "balanced", "frosted"];
const AMBIENT: readonly AmbientPreset[] = ["off", "subtle", "vivid"];
const DENSITY: readonly DensityPreset[] = ["compact", "comfortable", "spacious"];
const UI_SCALE: readonly UiScalePreset[] = ["small", "default", "large", "xl"];
const RADIUS: readonly RadiusPreset[] = ["sharp", "default", "round"];
const MARKET_COLORS: readonly MarketColorsPreset[] = ["default", "swapped", "colorblind"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
  if (typeof value === "string") {
    for (const candidate of allowed) {
      if (candidate === value) return candidate;
    }
  }
  return fallback;
};

const clampNumeric = (value: unknown, spec: NumericSpec, fallback: number): number => {
  const base = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(spec.max, Math.max(spec.min, base));
};

export function sanitizeAppearance(value: unknown): AppearancePrefs {
  const raw = isRecord(value) ? value : {};
  const glass = pick(raw.glass, GLASS, DEFAULT_APPEARANCE.glass);
  const ambient = pick(raw.ambient, AMBIENT, DEFAULT_APPEARANCE.ambient);
  const knobs = GLASS_PRESET_KNOBS[glass];
  return {
    glass,
    ambient,
    density: pick(raw.density, DENSITY, DEFAULT_APPEARANCE.density),
    uiScale: pick(raw.uiScale, UI_SCALE, DEFAULT_APPEARANCE.uiScale),
    radius: pick(raw.radius, RADIUS, DEFAULT_APPEARANCE.radius),
    marketColors: pick(raw.marketColors, MARKET_COLORS, DEFAULT_APPEARANCE.marketColors),
    glassAlpha: clampNumeric(raw.glassAlpha, NUMERIC_SPEC.glassAlpha, knobs.alpha),
    glassBlur: clampNumeric(raw.glassBlur, NUMERIC_SPEC.glassBlur, knobs.blur),
    glassEdge: clampNumeric(raw.glassEdge, NUMERIC_SPEC.glassEdge, knobs.edge),
    glassSaturate: clampNumeric(raw.glassSaturate, NUMERIC_SPEC.glassSaturate, knobs.saturate),
    glassBrightness: clampNumeric(
      raw.glassBrightness,
      NUMERIC_SPEC.glassBrightness,
      knobs.brightness,
    ),
    ambientIntensity: clampNumeric(
      raw.ambientIntensity,
      NUMERIC_SPEC.ambientIntensity,
      AMBIENT_PRESET_INTENSITY[ambient],
    ),
    noise: clampNumeric(raw.noise, NUMERIC_SPEC.noise, DEFAULT_APPEARANCE.noise),
  };
}

export function appearanceCssVars(prefs: AppearancePrefs): Record<string, string> {
  return {
    "--glass-alpha-k": String(prefs.glassAlpha),
    "--glass-blur-k": String(prefs.glassBlur),
    "--glass-edge-k": String(prefs.glassEdge),
    "--glass-sat-k": String(prefs.glassSaturate),
    "--glass-bright-k": String(prefs.glassBrightness),
    "--ambient-k": String(prefs.ambientIntensity),
    "--noise-a": String(prefs.noise),
  };
}

export function applyAppearance(prefs: AppearancePrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  for (const [name, value] of Object.entries(appearanceCssVars(prefs))) {
    root.style.setProperty(name, value);
  }

  root.dataset.glass = prefs.glass;
  root.dataset.ambient = prefs.ambient;
  root.dataset.density = prefs.density;
  root.dataset.radius = prefs.radius;
  root.dataset.marketColors = prefs.marketColors;

  if (prefs.uiScale === "default") {
    delete root.dataset.uiScale;
  } else {
    root.dataset.uiScale = prefs.uiScale;
  }
}

const readStoredAppearance = (): AppearancePrefs => {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_APPEARANCE };
    const parsed: unknown = JSON.parse(raw);
    const value = isRecord(parsed) && "state" in parsed ? parsed.state : parsed;
    return sanitizeAppearance(value);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
};

export function initAppearance(): void {
  if (typeof document === "undefined") return;
  applyAppearance(readStoredAppearance());
}
