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
 * Fluid row height for CSS consumers. Small delta (2.25rem–2.75rem) keeps the
 * rendered row within a few px of GRID_ROW_HEIGHT so panels do not reflow.
 */
export const GRID_ROW_HEIGHT_CSS = "clamp(2.25rem, 2.3vh + 1.2rem, 2.75rem)";

/**
 * Single source of truth for the vertical row pitch (row height + vertical
 * gutter). Panels, the container height, and drop-zone previews MUST all use
 * this so they cannot drift apart. Requires `--grid-row-height` to be set from
 * GRID_ROW_HEIGHT_CSS on the grid container.
 */
export const GRID_ROW_PITCH_CSS = "calc(var(--grid-row-height) + 0.5rem)";

/** Gap between grid cells in pixels */
export const GRID_GUTTER = 8;

/**
 * Initial layout reflecting the current UI placement:
 * Row 0: Chart (8 cols) | Orderbook (2 cols) | OrderForm (2 cols)
 * Row 1: Positions (12 cols, full width)
 */
export const INITIAL_LAYOUT: LayoutItem[] = [
  { i: "chart", x: 0, y: 0, w: 8, h: 20, minW: 4, minH: 8 },
  { i: "orderbook", x: 8, y: 0, w: 2, h: 20, minW: 1, minH: 6 },
  { i: "orderform", x: 10, y: 0, w: 2, h: 20, minW: 1, minH: 6 },
  { i: "positions", x: 0, y: 20, w: 12, h: 8, minW: 4, minH: 4 },
];
