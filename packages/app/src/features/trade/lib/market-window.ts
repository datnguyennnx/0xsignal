export interface MarketWindowInput {
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly rowHeight: number;
  readonly total: number;
  readonly overscan: number;
}

export interface MarketWindow {
  readonly start: number;
  readonly end: number;
  readonly topSpacer: number;
  readonly bottomSpacer: number;
}

/** Pure viewport math: no DOM, deterministic for identical inputs. */
export function computeWindow({
  scrollTop,
  viewportHeight,
  rowHeight,
  total,
  overscan,
}: MarketWindowInput): MarketWindow {
  const count = Math.max(0, Math.floor(total));
  if (count === 0 || rowHeight <= 0) {
    return { start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 };
  }

  const extra = Math.max(0, Math.floor(overscan));
  const top = Math.max(0, scrollTop);
  const height = Math.max(0, viewportHeight);
  const firstVisible = Math.floor(top / rowHeight);
  const visibleCount = Math.ceil(height / rowHeight);
  // A stale offset can outrun a shrunk list; clamp after the overscan subtraction
  // so `start <= end <= count` always holds and the slice is never inverted.
  const start = Math.min(Math.max(0, firstVisible - extra), count);
  const end = Math.min(count, Math.max(start, start + visibleCount + 2 * extra));

  return {
    start,
    end,
    topSpacer: start * rowHeight,
    bottomSpacer: (count - end) * rowHeight,
  };
}
