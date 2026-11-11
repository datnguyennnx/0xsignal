export const VISIBLE_RANGE_OVERSCAN = 3;

export interface VisibleRangeInput {
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly rowHeight: number;
  readonly total: number;
  readonly overscan?: number;
}

export interface VisibleRange {
  readonly startIndex: number;
  readonly endIndex: number;
}

export function computeVisibleRange({
  scrollTop,
  viewportHeight,
  rowHeight,
  total,
  overscan = VISIBLE_RANGE_OVERSCAN,
}: VisibleRangeInput): VisibleRange {
  const count = Math.max(0, Math.floor(total));
  if (count === 0 || rowHeight <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  const extra = Math.max(0, Math.floor(overscan));
  const top = Math.max(0, scrollTop);
  const height = Math.max(0, viewportHeight);
  const firstVisible = Math.floor(top / rowHeight);
  const startIndex = Math.min(Math.max(0, firstVisible - extra), count);
  const endIndex = Math.min(
    count,
    Math.max(startIndex, firstVisible + Math.ceil(height / rowHeight) + extra),
  );

  return { startIndex, endIndex };
}

export function visibleSymbols<T>(symbols: readonly T[], range: VisibleRange): readonly T[] {
  return symbols.slice(range.startIndex, range.endIndex);
}
