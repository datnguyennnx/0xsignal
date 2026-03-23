/**
 * Depth Chart Constants
 *
 * Configuration for depth chart visualization including:
 * - Color schemes for bid/ask areas
 * - Chart styling constants
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
