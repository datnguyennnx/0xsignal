import type { DepthLevel, DepthRenderableBounds } from "../constants";
import {
  mapCanvasXToPrice,
  mapDepthSideToCanvasPoints,
  mapPriceToCanvasX,
  mapTotalToCanvasY,
} from "./depth-canvas-mapping";
import { resolveDepthStepEpsilon } from "./depth-step-transform";

export type DepthHoverSide = "bids" | "asks" | null;

export interface DepthHoveredPriceBand {
  from: number;
  to: number;
}

export interface DepthHoverModel {
  side: DepthHoverSide;
  level: DepthLevel | null;
  price: number;
  amount: number | null;
  cumulative: number | null;
  distanceToCenter: number;
  canvasPoint: {
    x: number;
    y: number;
  } | null;
  hoveredPriceBand: DepthHoveredPriceBand;
  isInSpreadGap: boolean;
}

export interface DepthSideSnapshot {
  side: "bids" | "asks";
  price: number;
  amount: number;
  cumulative: number;
  canvasPoint?: {
    x: number;
    y: number;
  } | null;
}

interface ResolveDepthHoverOptions {
  x: number;
  width: number;
  height: number;
  bounds: DepthRenderableBounds | null;
  bids: DepthLevel[];
  asks: DepthLevel[];
  bestBid: number;
  bestAsk: number;
  maxTotal: number;
  tickSize: number;
  topPadding?: number;
  bottomPadding?: number;
  previousHover?: DepthHoverModel | null;
}

const STICKY_BAND_PAD_RATIO = 0.18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function findNearestByPrice(
  levels: DepthLevel[],
  targetPrice: number
): { level: DepthLevel; index: number } | null {
  if (!levels.length) {
    return null;
  }

  let best: DepthLevel | null = null;
  let bestIndex = -1;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (let index = 0; index < levels.length; index++) {
    const level = levels[index];
    const diff = Math.abs(level.price - targetPrice);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = level;
      bestIndex = index;
    }
  }

  if (!best || bestIndex < 0) {
    return null;
  }

  return { level: best, index: bestIndex };
}

function resolveBidStepLevelAtPrice(
  levels: DepthLevel[],
  hoverPrice: number
): { level: DepthLevel; index: number } | null {
  if (!levels.length) {
    return null;
  }
  let selectedIndex = -1;
  let selectedPrice = Number.POSITIVE_INFINITY;
  for (let index = 0; index < levels.length; index++) {
    const price = levels[index].price;
    if (price >= hoverPrice && price < selectedPrice) {
      selectedPrice = price;
      selectedIndex = index;
    }
  }
  if (selectedIndex < 0) {
    return { level: levels[levels.length - 1], index: levels.length - 1 };
  }
  return { level: levels[selectedIndex], index: selectedIndex };
}

function resolveAskStepLevelAtPrice(
  levels: DepthLevel[],
  hoverPrice: number
): { level: DepthLevel; index: number } | null {
  if (!levels.length) {
    return null;
  }
  let bestIndex = -1;
  let bestPrice = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < levels.length; index++) {
    const price = levels[index].price;
    if (price <= hoverPrice && price > bestPrice) {
      bestPrice = price;
      bestIndex = index;
    }
  }
  if (bestIndex < 0) {
    return { level: levels[0], index: 0 };
  }
  return { level: levels[bestIndex], index: bestIndex };
}

export function resolveDepthSideSnapshotAtPrice(
  side: "bids" | "asks",
  levels: DepthLevel[],
  price: number,
  geometry?: {
    bounds: DepthRenderableBounds;
    oppositeLevels: DepthLevel[];
    width: number;
    height: number;
    maxTotal: number;
    tickSize: number;
    topPadding?: number;
    bottomPadding?: number;
  }
): DepthSideSnapshot | null {
  if (!levels.length || !Number.isFinite(price)) {
    return null;
  }

  const stepLevel =
    side === "bids"
      ? resolveBidStepLevelAtPrice(levels, price)
      : resolveAskStepLevelAtPrice(levels, price);
  if (!stepLevel) {
    return null;
  }

  const nearest = findNearestByPrice(levels, price) ?? stepLevel;
  const snapshotPrice = nearest.level.price;
  const canvasPoint = geometry
    ? resolveDepthCanvasPoint({
        side,
        levels,
        oppositeLevels: geometry.oppositeLevels,
        bounds: geometry.bounds,
        width: geometry.width,
        height: geometry.height,
        maxTotal: geometry.maxTotal,
        tickSize: geometry.tickSize,
        price: snapshotPrice,
        cumulative: stepLevel.level.total,
        topPadding: geometry.topPadding,
        bottomPadding: geometry.bottomPadding,
      })
    : null;
  return {
    side,
    price: snapshotPrice,
    amount: nearest.level.size,
    cumulative: stepLevel.level.total,
    canvasPoint,
  };
}

function buildPriceBand(
  levels: DepthLevel[],
  index: number,
  bounds: DepthRenderableBounds
): DepthHoveredPriceBand {
  const level = levels[index];
  const previous = levels[index - 1];
  const next = levels[index + 1];
  const leftMid = previous ? (previous.price + level.price) / 2 : bounds.minPrice;
  const rightMid = next ? (next.price + level.price) / 2 : bounds.maxPrice;
  return {
    from: Math.min(leftMid, rightMid),
    to: Math.max(leftMid, rightMid),
  };
}

function isWithinBandWithPad(price: number, band: DepthHoveredPriceBand): boolean {
  const span = Math.max(band.to - band.from, 0.00000001);
  const pad = span * STICKY_BAND_PAD_RATIO;
  return price >= band.from - pad && price <= band.to + pad;
}

function resolveSide(hoverPrice: number, bestBid: number, bestAsk: number): DepthHoverSide {
  if (bestBid > 0 && bestAsk > 0 && bestAsk >= bestBid) {
    if (hoverPrice < bestBid) {
      return "bids";
    }
    if (hoverPrice > bestAsk) {
      return "asks";
    }
    return null;
  }
  return hoverPrice <= 0 ? "bids" : "asks";
}

function createSpreadGapHover(
  hoverPrice: number,
  bounds: DepthRenderableBounds,
  bestBid: number,
  bestAsk: number
): DepthHoverModel {
  return {
    side: null,
    level: null,
    price: hoverPrice,
    amount: null,
    cumulative: null,
    distanceToCenter: hoverPrice - bounds.centerPrice,
    canvasPoint: null,
    hoveredPriceBand: {
      from: bestBid,
      to: bestAsk,
    },
    isInSpreadGap: true,
  };
}

function resolvePolylineYAtX(line: Array<{ x: number; y: number }>, x: number): number | null {
  if (line.length < 2) {
    return line[0]?.y ?? null;
  }
  for (let index = 1; index < line.length; index++) {
    const from = line[index - 1];
    const to = line[index];
    const minX = Math.min(from.x, to.x);
    const maxX = Math.max(from.x, to.x);
    if (x < minX || x > maxX) {
      continue;
    }
    if (Math.abs(to.x - from.x) < 1e-9) {
      return to.y;
    }
    const ratio = (x - from.x) / (to.x - from.x);
    return from.y + (to.y - from.y) * ratio;
  }
  return line[line.length - 1]?.y ?? null;
}

function resolveDepthCanvasPoint({
  side,
  levels,
  oppositeLevels,
  bounds,
  width,
  height,
  maxTotal,
  tickSize,
  price,
  cumulative,
  topPadding = 12,
  bottomPadding = 24,
}: {
  side: "bids" | "asks";
  levels: DepthLevel[];
  oppositeLevels: DepthLevel[];
  bounds: DepthRenderableBounds;
  width: number;
  height: number;
  maxTotal: number;
  tickSize: number;
  price: number;
  cumulative: number;
  topPadding?: number;
  bottomPadding?: number;
}): { x: number; y: number } | null {
  if (!levels.length || width <= 0 || height <= 0) {
    return null;
  }
  const epsilon = resolveDepthStepEpsilon(
    side === "bids" ? levels : oppositeLevels,
    side === "asks" ? levels : oppositeLevels,
    null,
    tickSize
  );
  const path = mapDepthSideToCanvasPoints({
    levels,
    side,
    bounds,
    width,
    height,
    epsilon,
    maxTotal,
    topPadding,
    bottomPadding,
  });
  const x = mapPriceToCanvasX(price, { bounds, width });
  const yOnLine = resolvePolylineYAtX(path.line, x);
  const yFallback = mapTotalToCanvasY(cumulative, {
    height,
    maxTotal,
    topPadding,
    bottomPadding,
  });
  return { x, y: yOnLine ?? yFallback };
}

export function resolveDepthHover({
  x,
  width,
  height,
  bounds,
  bids,
  asks,
  bestBid,
  bestAsk,
  maxTotal,
  tickSize,
  topPadding = 12,
  bottomPadding = 24,
  previousHover = null,
}: ResolveDepthHoverOptions): DepthHoverModel | null {
  if (!bounds || width <= 0 || height <= 0 || !bids.length || !asks.length) {
    return null;
  }

  const clampedX = clamp(x, 0, width);
  const hoverPrice = mapCanvasXToPrice(clampedX, { bounds, width });
  const inSpreadGap = bestBid > 0 && bestAsk > 0 && hoverPrice > bestBid && hoverPrice < bestAsk;
  if (inSpreadGap) {
    return createSpreadGapHover(hoverPrice, bounds, bestBid, bestAsk);
  }

  const side = resolveSide(hoverPrice, bestBid, bestAsk);
  if (!side) {
    return null;
  }
  const sideLevels = side === "bids" ? bids : asks;
  const stepLevelAtHover =
    side === "bids"
      ? resolveBidStepLevelAtPrice(sideLevels, hoverPrice)
      : resolveAskStepLevelAtPrice(sideLevels, hoverPrice);
  if (!stepLevelAtHover) {
    return null;
  }
  const nearest = findNearestByPrice(sideLevels, hoverPrice);
  const selectedByPrice = nearest ?? stepLevelAtHover;
  const nearestBand = buildPriceBand(sideLevels, selectedByPrice.index, bounds);
  const previousIsStickyCandidate =
    previousHover &&
    !previousHover.isInSpreadGap &&
    previousHover.side === side &&
    previousHover.level &&
    isWithinBandWithPad(hoverPrice, previousHover.hoveredPriceBand);

  const selectedLevel = previousIsStickyCandidate ? previousHover.level : selectedByPrice.level;
  const selectedBand = previousIsStickyCandidate ? previousHover.hoveredPriceBand : nearestBand;
  if (!selectedLevel) {
    return null;
  }

  const lineLevel = previousIsStickyCandidate ? selectedLevel : stepLevelAtHover.level;
  const snappedPrice = selectedLevel.price;
  const canvasPoint = resolveDepthCanvasPoint({
    side,
    levels: sideLevels,
    oppositeLevels: side === "bids" ? asks : bids,
    bounds,
    width,
    height,
    maxTotal,
    tickSize,
    price: snappedPrice,
    cumulative: lineLevel.total,
    topPadding,
    bottomPadding,
  });

  return {
    side,
    level: selectedLevel,
    price: snappedPrice,
    amount: selectedLevel.size,
    cumulative: lineLevel.total,
    distanceToCenter: snappedPrice - bounds.centerPrice,
    canvasPoint,
    hoveredPriceBand: selectedBand,
    isInSpreadGap: false,
  };
}
