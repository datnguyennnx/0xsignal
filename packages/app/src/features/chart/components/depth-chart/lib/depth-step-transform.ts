import type { DepthLevel, DepthVisibleRange } from "../constants";
import { getMinHalfSpanValue } from "./depth-visible-range";

export interface DepthStepPoint {
  time: number;
  value: number;
}

function inferTickSize(levels: DepthLevel[]): number {
  if (levels.length < 2) {
    return getMinHalfSpanValue();
  }

  let minStep = Number.POSITIVE_INFINITY;
  for (let index = 1; index < levels.length; index++) {
    const diff = Math.abs(levels[index].price - levels[index - 1].price);
    if (diff > 0 && diff < minStep) {
      minStep = diff;
    }
  }

  return Number.isFinite(minStep) ? minStep : getMinHalfSpanValue();
}

function getPriceBounds(bids: DepthLevel[], asks: DepthLevel[]): DepthVisibleRange | null {
  const prices = [...bids.map((level) => level.price), ...asks.map((level) => level.price)];
  if (!prices.length) {
    return null;
  }

  return {
    from: Math.min(...prices),
    to: Math.max(...prices),
  };
}

export function resolveDepthStepEpsilon(
  bids: DepthLevel[],
  asks: DepthLevel[],
  visibleRange: DepthVisibleRange | null,
  tickSizeHint: number
): number {
  const tickSize = Math.max(
    Math.min(inferTickSize(bids), inferTickSize(asks)),
    tickSizeHint || getMinHalfSpanValue()
  );
  const bounds = getPriceBounds(bids, asks);
  const spanSource = visibleRange ?? bounds;
  const visibleSpan = spanSource ? Math.max(spanSource.to - spanSource.from, tickSize) : tickSize;

  return Math.max(tickSize * 0.35, visibleSpan / 1_000_000, getMinHalfSpanValue());
}

export function transformBidLevelsToSteps(bids: DepthLevel[], _epsilon: number): DepthStepPoint[] {
  if (!bids.length) {
    return [];
  }

  const sorted = [...bids].sort((a, b) => a.price - b.price);
  const steps: DepthStepPoint[] = [{ time: sorted[0].price, value: 0 }];

  for (let index = 0; index < sorted.length; index++) {
    const current = sorted[index];
    const previous = sorted[index - 1];

    if (previous) {
      steps.push({
        time: current.price,
        value: previous.total,
      });
    }
    steps.push({
      time: current.price,
      value: current.total,
    });
  }

  const last = sorted[sorted.length - 1];
  // Drop to zero exactly at spread edge (best bid) to preserve strict 90-degree step geometry.
  steps.push({
    time: last.price,
    value: 0,
  });

  return steps;
}

export function transformAskLevelsToSteps(asks: DepthLevel[], _epsilon: number): DepthStepPoint[] {
  if (!asks.length) {
    return [];
  }

  const sorted = [...asks].sort((a, b) => a.price - b.price);
  const steps: DepthStepPoint[] = [{ time: sorted[0].price, value: 0 }];

  for (let index = 0; index < sorted.length; index++) {
    const current = sorted[index];
    const previous = sorted[index - 1];

    if (previous) {
      steps.push({
        time: current.price,
        value: previous.total,
      });
    }
    steps.push({
      time: current.price,
      value: current.total,
    });
  }

  return steps;
}
