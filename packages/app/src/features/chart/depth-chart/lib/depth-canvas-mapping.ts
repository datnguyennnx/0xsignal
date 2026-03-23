/**
 * @overview Depth Chart Canvas Mapping Utilities
 *
 * Provides functions to translate market data (price, volume) into canvas coordinates (x, y).
 * Handles calculations for viewport bounds, y-axis scaling, and point materialization.
 */
import type { DepthLevel, DepthRenderableBounds } from "../constants";
import {
  type DepthStepPoint,
  transformAskLevelsToSteps,
  transformBidLevelsToSteps,
} from "./depth-step-transform";

export interface CanvasPoint {
  x: number;
  y: number;
}

interface MapDepthSideToCanvasPointsOptions {
  levels: DepthLevel[];
  side: "bids" | "asks";
  bounds: DepthRenderableBounds | null;
  width: number;
  height: number;
  epsilon: number;
  maxTotal: number;
  topPadding?: number;
  bottomPadding?: number;
}

export interface DepthCanvasScaleOptions {
  bounds: DepthRenderableBounds;
  width: number;
  height: number;
  maxTotal: number;
  topPadding?: number;
  bottomPadding?: number;
}

function toFiniteMonotonicPoints(
  points: DepthStepPoint[],
  bounds: DepthRenderableBounds,
  width: number,
  height: number,
  maxTotal: number,
  topPadding: number,
  bottomPadding: number
): CanvasPoint[] {
  const spanX = Math.max(bounds.maxPrice - bounds.minPrice, 0.00000001);
  const drawHeight = Math.max(height - topPadding - bottomPadding, 1);
  const safeMaxTotal = Math.max(maxTotal, 1);

  const mapped: CanvasPoint[] = [];
  let lastX = Number.NEGATIVE_INFINITY;
  let lastY = Number.NaN;

  for (const point of points) {
    if (!Number.isFinite(point.time) || !Number.isFinite(point.value)) {
      continue;
    }

    if (point.time < bounds.minPrice || point.time > bounds.maxPrice) {
      continue;
    }

    const normalizedX = (point.time - bounds.minPrice) / spanX;
    const x = normalizedX * width;
    const y = topPadding + (1 - point.value / safeMaxTotal) * drawHeight;

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }

    const clampedX = Math.min(Math.max(x, 0), width);
    const clampedY = Math.min(Math.max(y, 0), height);

    if (clampedX < lastX) {
      continue;
    }

    // Allow same X with different Y to preserve vertical 90-degree walls.
    if (clampedX === lastX && clampedY === lastY) {
      continue;
    }

    mapped.push({ x: clampedX, y: clampedY });
    lastX = clampedX;
    lastY = clampedY;
  }

  return mapped;
}

export function getDepthMaxTotal(bids: DepthLevel[], asks: DepthLevel[]): number {
  return Math.max(1, bids[bids.length - 1]?.total ?? 0, asks[asks.length - 1]?.total ?? 0);
}

export function mapPriceToCanvasX(
  price: number,
  { bounds, width }: Pick<DepthCanvasScaleOptions, "bounds" | "width">
): number {
  const spanX = Math.max(bounds.maxPrice - bounds.minPrice, 0.00000001);
  const normalizedX = (price - bounds.minPrice) / spanX;
  return Math.min(Math.max(normalizedX * width, 0), width);
}

export function mapCanvasXToPrice(
  x: number,
  { bounds, width }: Pick<DepthCanvasScaleOptions, "bounds" | "width">
): number {
  if (width <= 0) {
    return bounds.minPrice;
  }
  const normalized = Math.min(Math.max(x / width, 0), 1);
  return bounds.minPrice + (bounds.maxPrice - bounds.minPrice) * normalized;
}

export function mapTotalToCanvasY(
  total: number,
  {
    height,
    maxTotal,
    topPadding = 12,
    bottomPadding = 6,
  }: Pick<DepthCanvasScaleOptions, "height" | "maxTotal" | "topPadding" | "bottomPadding">
): number {
  const drawHeight = Math.max(height - topPadding - bottomPadding, 1);
  const safeMaxTotal = Math.max(maxTotal, 1);
  const y = topPadding + (1 - total / safeMaxTotal) * drawHeight;
  return Math.min(Math.max(y, 0), height);
}

export function mapDepthSideToCanvasPoints({
  levels,
  side,
  bounds,
  width,
  height,
  epsilon,
  maxTotal,
  topPadding = 12,
  bottomPadding = 6,
}: MapDepthSideToCanvasPointsOptions): { line: CanvasPoint[]; area: CanvasPoint[] } {
  if (!bounds || width <= 0 || height <= 0 || !levels.length || !Number.isFinite(epsilon)) {
    return { line: [], area: [] };
  }

  const rawPoints =
    side === "bids"
      ? transformBidLevelsToSteps(levels, epsilon)
      : transformAskLevelsToSteps(levels, epsilon);

  const line = toFiniteMonotonicPoints(
    rawPoints,
    bounds,
    width,
    height,
    maxTotal,
    topPadding,
    bottomPadding
  );
  if (!line.length) {
    return { line: [], area: [] };
  }

  const baseY = Math.max(height - bottomPadding, topPadding);
  const first = line[0];
  const last = line[line.length - 1];
  const area: CanvasPoint[] = [...line, { x: last.x, y: baseY }, { x: first.x, y: baseY }];

  return { line, area };
}
