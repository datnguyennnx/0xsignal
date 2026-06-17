import type { LayoutItem } from "./types";

export const LAYOUT_STORAGE_KEY = "0xsignal_layout_config";

export const GRID_COLS = 12;

/** Height of each grid row in pixels */
export const GRID_ROW_HEIGHT = 40;

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
