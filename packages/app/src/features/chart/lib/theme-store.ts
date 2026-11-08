import { useSyncExternalStore } from "react";

import { readRootStyle } from "@/lib/css-tokens";
import { toRgb } from "./color";

export const CHART_TOKENS = [
  "--data-grid",
  "--data-axis",
  "--data-crosshair",
  "--data-up",
  "--data-down",
  "--data-volume",
  "--gain",
  "--loss",
  "--muted-foreground",
  "--accent-ink",
  "--data-1",
  "--data-2",
  "--data-3",
  "--data-4",
  "--data-5",
  "--data-6",
  "--data-7",
  "--data-8",
  "--candle-up",
  "--candle-down",
] as const;

export type ChartToken = (typeof CHART_TOKENS)[number];

export interface ChartThemeSnapshot {
  version: number;
  colors: Record<string, string>;
  fontSize: number;
}

const SERIES_TOKENS = [
  "--data-1",
  "--data-2",
  "--data-3",
  "--data-4",
  "--data-5",
  "--data-6",
  "--data-7",
  "--data-8",
] as const;

const resolveToken = (style: CSSStyleDeclaration | null, token: ChartToken): string =>
  style === null ? toRgb("") : toRgb(style.getPropertyValue(token).trim());

const resolveColors = (style: CSSStyleDeclaration | null): Record<string, string> =>
  Object.fromEntries(CHART_TOKENS.map((token) => [token, resolveToken(style, token)]));

const FALLBACK_FONT_SIZE = 12;
const FALLBACK_ROOT_FONT_SIZE = 16;

const resolveFontSize = (style: CSSStyleDeclaration | null): number => {
  if (style === null) return FALLBACK_FONT_SIZE;
  const raw = (style.getPropertyValue("--text-data") ?? "").trim();
  const rem = /^([\d.]+)rem$/.exec(raw);
  if (rem !== null) {
    const rootPx = Number(style.fontSize);
    const remPx = Number(rem[1] ?? "");
    return remPx * (Number.isFinite(rootPx) ? rootPx : FALLBACK_ROOT_FONT_SIZE);
  }
  const px = raw === "" ? Number.NaN : Number(raw);
  return Number.isFinite(px) ? px : FALLBACK_FONT_SIZE;
};

const FALLBACK_COLOR = "#636363";

/** Static seed: renders never touch computed style, the resolved theme arrives in a frame. */
const fallbackSnapshot = (): ChartThemeSnapshot => ({
  version: 0,
  colors: Object.fromEntries(CHART_TOKENS.map((token) => [token, FALLBACK_COLOR])),
  fontSize: FALLBACK_FONT_SIZE,
});

const buildSnapshot = (version: number): ChartThemeSnapshot => {
  // One computed-style read feeds all 20 tokens and the font size.
  const style = readRootStyle();
  return {
    version,
    colors: resolveColors(style),
    fontSize: resolveFontSize(style),
  };
};

const staticSnapshot = fallbackSnapshot();
let snapshot: ChartThemeSnapshot | null = null;
let observer: MutationObserver | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

/** Cached only: safe to call from render, never touches computed style. */
const readSnapshot = (): ChartThemeSnapshot => snapshot ?? staticSnapshot;

export const getChartTheme = (): ChartThemeSnapshot => (snapshot ??= buildSnapshot(0));

const notify = (): void => {
  snapshot = buildSnapshot((snapshot?.version ?? -1) + 1);
  for (const listener of listeners) listener();
};

let notifyHandle: number | null = null;

/**
 * Attribute mutations arrive in batches (a settings write touches several
 * attributes). Re-resolving the 20 chart tokens once per frame keeps a slider
 * drag from rebuilding the snapshot on every input event.
 */
const scheduleNotify = (): void => {
  if (typeof requestAnimationFrame !== "function") {
    notify();
    return;
  }
  if (notifyHandle !== null) return;
  notifyHandle = requestAnimationFrame(() => {
    notifyHandle = null;
    notify();
  });
};

const observeTheme = (): void => {
  if (observer !== null || typeof document === "undefined") return;
  if (typeof MutationObserver === "undefined") return;
  observer = new MutationObserver(scheduleNotify);
  // Only attributes the chart palette depends on: theme class and market colours.
  // `style` changes are density/knob values and cannot alter a chart token.
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-market-colors"],
  });
};

export const subscribeChartTheme = (listener: () => void): (() => void) => {
  listeners.add(listener);
  observeTheme();
  if (snapshot === null && !hydrated) {
    hydrated = true;
    // Resolve the tokens off the render path, once per frame at most.
    scheduleNotify();
  }
  return () => {
    listeners.delete(listener);
  };
};

export const useChartTheme = (): ChartThemeSnapshot =>
  useSyncExternalStore(subscribeChartTheme, readSnapshot, readSnapshot);

/** Series identity, never gain/loss: the hash only picks a slot of the categorical ramp. */
export const getSeriesColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash, 31) + (seed.codePointAt(i) ?? 0);
  }
  const token = SERIES_TOKENS[Math.abs(hash) % SERIES_TOKENS.length];
  return readSnapshot().colors[token];
};
