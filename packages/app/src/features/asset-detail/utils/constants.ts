import type { LayoutItem } from "./types";

export const LAYOUT_STORAGE_KEY = "0xsignal_layout_config";

export const GRID_COLS = 12;

/** Design-token row height in rem; grid math and the fluid CSS clamp key off this. */
const GRID_ROW_HEIGHT_REM = 2.5;

/**
 * Height of each grid row in pixels. Derived (not a bare literal) so the fluid
 * CSS value below can be tracked from one token; stays a number for gesture math.
 */
export const GRID_ROW_HEIGHT = GRID_ROW_HEIGHT_REM * 16;

/**
 * Single source of truth for the vertical row pitch (row height + vertical
 * gutter). Panels, the drop-zone previews and the drag gesture all use this so
 * they cannot drift apart. Requires `--grid-row-height` to be set on the grid
 * canvas, which DashboardGrid derives from the fit pitch (see dashboard-grid.tsx).
 */
export const GRID_ROW_PITCH_CSS = "calc(var(--grid-row-height) + 0.5rem)";

/** Gap between grid cells in pixels */
export const GRID_GUTTER = 8;

/** Smallest footprint a panel stays usable at, in grid cells. */
interface PanelMin {
  minW: number;
  minH: number;
}

/**
 * Per-panel minimums live here, not in the persisted layout: a stored item can
 * carry a stale `minW` from an older release, and the readable floor must win.
 */
const PANEL_MIN: Record<string, PanelMin> = {
  chart: { minW: 4, minH: 6 },
  orderbook: { minW: 2, minH: 8 },
  orderform: { minW: 2, minH: 8 },
  positions: { minW: 4, minH: 3 },
};

export function panelMin(id: string): PanelMin {
  return PANEL_MIN[id] ?? { minW: 1, minH: 1 };
}

/**
 * Initial layout — three full-height columns in one viewport region:
 * Row band 0-15: Chart (11 rows, 8 cols) | Order book (2 cols) | Order form (2 cols)
 * Row band 11-15: Positions (5 rows, 8 cols) — a compact strip under the chart only.
 * The 16-row total sets the fit pitch, so the default fills the region exactly.
 */
export const INITIAL_LAYOUT: LayoutItem[] = [
  { i: "chart", x: 0, y: 0, w: 8, h: 11, ...PANEL_MIN.chart },
  { i: "orderbook", x: 8, y: 0, w: 2, h: 16, ...PANEL_MIN.orderbook },
  { i: "orderform", x: 10, y: 0, w: 2, h: 16, ...PANEL_MIN.orderform },
  { i: "positions", x: 0, y: 11, w: 8, h: 5, ...PANEL_MIN.positions },
];

/** Rows the initial layout spans — the row count that defines the fit. */
export const DEFAULT_ROW_COUNT = INITIAL_LAYOUT.reduce(
  (rows, item) => Math.max(rows, item.y + item.h),
  0,
);

/**
 * Hard ceiling on canvas rows. The canvas grows with the user's layout so panels
 * are never clipped, but a resize has to hit a wall somewhere — this is it.
 */
export const MAX_GRID_ROWS = DEFAULT_ROW_COUNT * 2;

const ROW_GUTTER_REM = 0.5;

/**
 * Fit pitch: the row height that packs DEFAULT_ROW_COUNT rows into the trading region
 * left over by the market header and the region's column gap. A definite length on the
 * first paint, and only a starting point — the canvas grows past it when the user's
 * layout needs more rows (see dashboard-grid.tsx). `--trading-header-offset` is the
 * header + gap block, published pre-paint by AssetContent.
 */
export const GRID_ROW_HEIGHT_FIT_CSS = `calc((var(--trading-region-height) - var(--trading-header-offset, 0px) - ${(DEFAULT_ROW_COUNT - 1) * ROW_GUTTER_REM}rem) / ${DEFAULT_ROW_COUNT})`;

/** Canvas height for `rowCount` rows, gutters included — grows with the user's layout. */
export function gridRowsHeightCss(rowCount: number): string {
  return `calc(${rowCount} * var(--grid-row-height) + ${(rowCount - 1) * ROW_GUTTER_REM}rem)`;
}
