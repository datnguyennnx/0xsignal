import type { OrderbookData, OrderbookLevel } from "@/hooks/use-hyperliquid-orderbook";
import type { DepthLevel, DepthRenderableBounds } from "../constants";
import { getMinHalfSpanValue } from "../lib/depth-visible-range";

const BUCKET_LADDER = [24, 32, 40, 48, 56, 64, 72, 84, 96, 112] as const;
const STEP_HYSTERESIS_LOWER = 0.74;
const STEP_HYSTERESIS_UPPER = 1.36;
const BUCKET_COUNT_HYSTERESIS = 0.24;

interface UseDepthChartMaterializationOptions {
  book: OrderbookData | null;
  centerPrice: number;
  halfSpan: number;
  viewportWidth: number;
  bestBid: number;
  bestAsk: number;
  tickSize: number;
  previousBucketStep?: number | null;
}

export interface DepthMaterializationResult {
  bids: DepthLevel[];
  asks: DepthLevel[];
  bounds: DepthRenderableBounds | null;
  hasRenderableFrame: boolean;
  bucketStep: number;
}

function normalizeStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) {
    return getMinHalfSpanValue();
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }

  if (normalized <= 2) {
    return 2 * magnitude;
  }

  if (normalized <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
}

function resolveBucketCount(
  viewportWidth: number,
  previousStep: number | null,
  span: number
): number {
  const baseTarget = Math.max(28, Math.round(Math.max(viewportWidth, 320) / 18));
  const nearest = BUCKET_LADDER.reduce((best, candidate) =>
    Math.abs(candidate - baseTarget) < Math.abs(best - baseTarget) ? candidate : best
  );
  if (!previousStep || !Number.isFinite(previousStep) || previousStep <= 0) {
    return nearest;
  }
  const impliedPreviousBuckets = Math.max(1, Math.round(span / previousStep));
  const diffRatio = Math.abs(impliedPreviousBuckets - nearest) / Math.max(nearest, 1);
  if (diffRatio <= BUCKET_COUNT_HYSTERESIS) {
    return impliedPreviousBuckets;
  }
  return nearest;
}

function resolveStableBucketStep(
  rawStep: number,
  tickSize: number,
  previousStep: number | null
): number {
  const normalized = Math.max(normalizeStep(rawStep), tickSize, getMinHalfSpanValue());
  if (!previousStep || !Number.isFinite(previousStep) || previousStep <= 0) {
    return normalized;
  }
  if (
    normalized >= previousStep * STEP_HYSTERESIS_LOWER &&
    normalized <= previousStep * STEP_HYSTERESIS_UPPER
  ) {
    return previousStep;
  }
  return normalized;
}

function rebuildCumulative(levels: Array<{ price: number; size: number }>, side: "bids" | "asks") {
  const sorted = [...levels].sort((a, b) =>
    side === "bids" ? b.price - a.price : a.price - b.price
  );
  let total = 0;

  return sorted.map((level) => ({
    price: level.price,
    size: level.size,
    total: (total += level.size),
  }));
}

function bucketLevels(
  levels: OrderbookLevel[],
  step: number,
  side: "bids" | "asks"
): Array<{ price: number; size: number; total: number }> {
  if (!levels.length || step <= 0) {
    return levels;
  }

  const grouped = new Map<number, number>();
  const inverse = 1 / step;
  const precision = Math.max(0, Math.ceil(-Math.log10(step)));

  for (const level of levels) {
    const bucketPrice =
      side === "bids"
        ? Math.floor(level.price * inverse) / inverse
        : Math.ceil(level.price * inverse) / inverse;
    const key = Number(bucketPrice.toFixed(precision));
    grouped.set(key, (grouped.get(key) ?? 0) + level.size);
  }

  return rebuildCumulative(
    Array.from(grouped.entries()).map(([price, size]) => ({ price, size })),
    side
  );
}

function toDepthLevels(
  levels: Array<{ price: number; size: number; total: number }>
): DepthLevel[] {
  return levels.map((level) => ({
    price: level.price,
    size: level.size,
    total: level.total,
  }));
}

function filterBidLevels(
  levels: OrderbookLevel[],
  centerPrice: number,
  bestBid: number,
  halfSpan: number
): OrderbookLevel[] {
  const minPrice = centerPrice - halfSpan;
  const maxPrice = Math.min(bestBid || centerPrice, centerPrice);
  return levels.filter((level) => level.price >= minPrice && level.price <= maxPrice);
}

function filterAskLevels(
  levels: OrderbookLevel[],
  centerPrice: number,
  bestAsk: number,
  halfSpan: number
): OrderbookLevel[] {
  const minPrice = Math.max(bestAsk || centerPrice, centerPrice);
  const maxPrice = centerPrice + halfSpan;
  return levels.filter((level) => level.price >= minPrice && level.price <= maxPrice);
}

function deriveRenderableBounds(
  bids: OrderbookLevel[],
  asks: OrderbookLevel[],
  halfSpan: number,
  bestBid: number,
  bestAsk: number,
  centerPrice: number
): DepthRenderableBounds | null {
  if (!bids.length || !asks.length) {
    return null;
  }

  const minPrice = centerPrice - halfSpan;
  const maxPrice = centerPrice + halfSpan;
  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice >= maxPrice) {
    return null;
  }

  return {
    minPrice,
    maxPrice,
    bestBid,
    bestAsk,
    centerPrice,
  };
}

export function materializeDepthFrame({
  book,
  centerPrice,
  halfSpan,
  viewportWidth,
  bestBid,
  bestAsk,
  tickSize,
  previousBucketStep = null,
}: UseDepthChartMaterializationOptions): DepthMaterializationResult {
  if (!book || !Number.isFinite(centerPrice) || centerPrice <= 0 || !Number.isFinite(halfSpan)) {
    return {
      bids: [],
      asks: [],
      bounds: null,
      hasRenderableFrame: false,
      bucketStep: Math.max(tickSize, getMinHalfSpanValue()),
    };
  }

  const visibleSpan = Math.max(halfSpan * 2, getMinHalfSpanValue());
  const desiredBuckets = resolveBucketCount(viewportWidth, previousBucketStep, visibleSpan);
  const rawStep = visibleSpan / Math.max(1, desiredBuckets);
  const step = resolveStableBucketStep(rawStep, tickSize, previousBucketStep);
  const outerPadding = Math.min(
    Math.max(halfSpan * 0.04, tickSize * 2),
    Math.max(book.spread * 1.2, tickSize * 6, centerPrice * 0.00005)
  );
  const effectiveHalfSpan = halfSpan + outerPadding;

  const visibleBids = filterBidLevels(book.bids, centerPrice, bestBid, effectiveHalfSpan);
  const visibleAsks = filterAskLevels(book.asks, centerPrice, bestAsk, effectiveHalfSpan);
  const bounds = deriveRenderableBounds(
    visibleBids,
    visibleAsks,
    halfSpan,
    bestBid,
    bestAsk,
    centerPrice
  );

  if (!bounds) {
    return {
      bids: [],
      asks: [],
      bounds: null,
      hasRenderableFrame: false,
      bucketStep: step,
    };
  }

  const materializedBids = toDepthLevels(bucketLevels(visibleBids, step, "bids"));
  const materializedAsks = toDepthLevels(bucketLevels(visibleAsks, step, "asks"));

  return {
    bids: materializedBids,
    asks: materializedAsks,
    bounds,
    hasRenderableFrame: materializedBids.length > 0 && materializedAsks.length > 0,
    bucketStep: step,
  };
}
