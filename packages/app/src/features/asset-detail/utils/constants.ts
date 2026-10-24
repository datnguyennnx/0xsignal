import { remToPx } from "@/core/utils/rem";
import type { LayoutItem } from "./types";

export const LAYOUT_STORAGE_KEY = "0xsignal_layout_config";

/** 26 columns: the chart/book/form split is 16:5:5, and every width/bound/snap step derives from this. */
export const GRID_COLS = 26;

/** Design-token row height in rem; grid math and the fluid CSS clamp key off this. */
const GRID_ROW_HEIGHT_REM = 2.5;
const GRID_GUTTER_REM = 0.5;

/** Row height in px at the current root font-size (per call: the root size is fluid). */
export function getGridRowHeight(): number {
  return remToPx(GRID_ROW_HEIGHT_REM);
}

/** Single source of vertical row pitch (row height + gutter); needs --grid-row-height on the canvas. */
export const GRID_ROW_PITCH_CSS = `calc(var(--grid-row-height) + ${GRID_GUTTER_REM}rem)`;

/** Gap between grid cells in pixels, re-derived per call for the same reason. */
export function getGridGutter(): number {
  return remToPx(GRID_GUTTER_REM);
}

/** Smallest footprint a panel stays usable at, in grid cells. */
interface PanelMin {
  minW: number;
  minH: number;
}

/** Per-panel minimums live here; a stored item's stale minW must not win. */
const PANEL_MIN: Record<string, PanelMin> = {
  chart: { minW: 9, minH: 6 },
  orderbook: { minW: 4, minH: 8 },
  orderform: { minW: 4, minH: 8 },
  positions: { minW: 9, minH: 3 },
};

export function panelMin(id: string): PanelMin {
  return PANEL_MIN[id] ?? { minW: 1, minH: 1 };
}

/** Default layout: 16-wide chart over a positions strip, 5-col book and form; 16 rows fill the region. */
export const INITIAL_LAYOUT: LayoutItem[] = [
  { i: "chart", x: 0, y: 0, w: 16, h: 11, ...PANEL_MIN.chart },
  { i: "positions", x: 0, y: 11, w: 16, h: 5, ...PANEL_MIN.positions },
  { i: "orderbook", x: 16, y: 0, w: 5, h: 16, ...PANEL_MIN.orderbook },
  { i: "orderform", x: 21, y: 0, w: 5, h: 16, ...PANEL_MIN.orderform },
];

/** Rows the initial layout spans — the row count that defines the fit. */
export const DEFAULT_ROW_COUNT = INITIAL_LAYOUT.reduce(
  (rows, item) => Math.max(rows, item.y + item.h),
  0,
);

/** Low-viewport preset: same 16/5/5 split and 16-row band, only heights differ. */
const COMPACT_LAYOUT: LayoutItem[] = [
  { i: "chart", x: 0, y: 0, w: 16, h: 9, ...PANEL_MIN.chart },
  { i: "orderbook", x: 16, y: 0, w: 5, h: 16, ...PANEL_MIN.orderbook },
  { i: "orderform", x: 21, y: 0, w: 5, h: 16, ...PANEL_MIN.orderform },
  { i: "positions", x: 0, y: 9, w: 16, h: 7, ...PANEL_MIN.positions },
];

/** Below a 1500x900 CSS-pixel viewport, order entry wins over chart real estate. */
function prefersCompactLayout(viewportWidthPx: number, viewportHeightPx: number): boolean {
  return viewportHeightPx < 900 || viewportWidthPx < 1500;
}

/** A fresh layout for the viewport, so callers never share the module constant. */
export function initialLayoutForViewport(widthPx: number, heightPx: number): LayoutItem[] {
  const preset = prefersCompactLayout(widthPx, heightPx) ? COMPACT_LAYOUT : INITIAL_LAYOUT;
  return structuredClone(preset);
}

/** Hard ceiling on canvas rows: the canvas grows with the layout, but a resize needs a wall. */
export const MAX_GRID_ROWS = DEFAULT_ROW_COUNT * 2;

/** Fit pitch packs DEFAULT_ROW_COUNT rows into the trading region; only a starting point. */
export const GRID_ROW_HEIGHT_FIT_CSS = `calc((var(--trading-region-height) - var(--trading-header-offset, 0px) - ${(DEFAULT_ROW_COUNT - 1) * GRID_GUTTER_REM}rem) / ${DEFAULT_ROW_COUNT})`;

/** Canvas height for `rowCount` rows, gutters included — grows with the user's layout. */
export function gridRowsHeightCss(rowCount: number): string {
  return `calc(${rowCount} * var(--grid-row-height) + ${(rowCount - 1) * GRID_GUTTER_REM}rem)`;
}
