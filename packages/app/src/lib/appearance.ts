export const APPEARANCE_STORAGE_KEY = "0xsignal.appearance.v1";

export type GlassPreset = "clear" | "balanced" | "frosted";
export type AmbientPreset = "off" | "subtle" | "vivid";
export type DensityPreset = "compact" | "comfortable" | "spacious";
export type UiScalePreset = "small" | "default" | "large" | "xl";
export type RadiusPreset = "sharp" | "default" | "round";
export type MarketColorsPreset = "default" | "swapped" | "colorblind";

export interface AppearancePrefs {
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

export function sanitizeAppearance(value: unknown): AppearancePrefs {
  if (!isRecord(value)) return { ...DEFAULT_APPEARANCE };
  return {
    glass: pick(value.glass, GLASS, DEFAULT_APPEARANCE.glass),
    ambient: pick(value.ambient, AMBIENT, DEFAULT_APPEARANCE.ambient),
    density: pick(value.density, DENSITY, DEFAULT_APPEARANCE.density),
    uiScale: pick(value.uiScale, UI_SCALE, DEFAULT_APPEARANCE.uiScale),
    radius: pick(value.radius, RADIUS, DEFAULT_APPEARANCE.radius),
    marketColors: pick(value.marketColors, MARKET_COLORS, DEFAULT_APPEARANCE.marketColors),
  };
}

export function applyAppearance(prefs: AppearancePrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

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
