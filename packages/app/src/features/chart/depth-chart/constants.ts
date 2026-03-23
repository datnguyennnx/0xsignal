/**
 * @overview Depth Chart Constants & Types
 *
 * Defines the core interfaces and styling constants for the L2 depth visualization.
 * Used across the depth-chart feature to maintain consistent data structures and colors.
 */

export interface DepthLevel {
  price: number;
  size: number;
  total: number;
}

export interface DepthVisibleRange {
  from: number;
  to: number;
}

export interface DepthRenderableBounds {
  minPrice: number;
  maxPrice: number;
  bestBid: number;
  bestAsk: number;
  centerPrice: number;
}

export const DEPTH_COLORS = {
  bid: {
    line: "#26a69a",
  },
  ask: {
    line: "#ef5350",
  },
} as const;
