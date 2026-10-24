import type { LayoutItem } from "./types";
import { GRID_COLS, MAX_GRID_ROWS, panelMin } from "./constants";

/** Every width here is a fraction of container width (0..1), never pixels. */

/** Inter-cell gutter as a fraction of container width (not doubled with the column change). */
export const GRID_GUTTER_FRACTION = 0.008;

/** Per-column width as a fraction of container width, gutters excluded. */
export function cellWidth(): number {
  return (1 - GRID_GUTTER_FRACTION * (GRID_COLS - 1)) / GRID_COLS;
}

/** Snap a container-fraction delta to whole grid units. */
export function snapToGridUnits(fractionDelta: number, cellFraction: number): number {
  return Math.round(fractionDelta / (cellFraction + GRID_GUTTER_FRACTION));
}

/** Declarative per-panel floor wins over a persisted item's stale minimum. */
export function minCells(item: LayoutItem): { minW: number; minH: number } {
  const floor = panelMin(item.i);
  return {
    minW: Math.max(item.minW ?? 0, floor.minW),
    minH: Math.max(item.minH ?? 0, floor.minH),
  };
}

/** Free corridor around a resizable item as edge coordinates; every handle clamps to these. */
export interface ResizeBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Derive bounds from the nearest neighbour edge each side; passes repeat until
 *  they settle, since a corner grows on both axes at once. */
export function getResizeBounds(item: LayoutItem, others: LayoutItem[]): ResizeBounds {
  const itemRight = item.x + item.w;
  const itemBottom = item.y + item.h;
  const bounds: ResizeBounds = { minX: 0, maxX: GRID_COLS, minY: 0, maxY: MAX_GRID_ROWS };

  let previous: ResizeBounds;
  do {
    previous = { ...bounds };

    for (const other of others) {
      if (other.i === item.i) continue;
      if (other.x >= bounds.maxX || other.x + other.w <= bounds.minX) continue;
      if (other.y + other.h <= item.y) bounds.minY = Math.max(bounds.minY, other.y + other.h);
      else if (other.y >= itemBottom) bounds.maxY = Math.min(bounds.maxY, other.y);
    }

    for (const other of others) {
      if (other.i === item.i) continue;
      if (other.y >= bounds.maxY || other.y + other.h <= bounds.minY) continue;
      if (other.x + other.w <= item.x) bounds.minX = Math.max(bounds.minX, other.x + other.w);
      else if (other.x >= itemRight) bounds.maxX = Math.min(bounds.maxX, other.x);
    }
  } while (
    bounds.minX !== previous.minX ||
    bounds.maxX !== previous.maxX ||
    bounds.minY !== previous.minY ||
    bounds.maxY !== previous.maxY
  );

  return bounds;
}

function isOverlapping(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Resolve grid collisions after a reposition; a resize is already clamped, so
 *  it returns unchanged. */
export function resolveCollisions(
  items: LayoutItem[],
  activeItemId?: string,
  interactionType?: "drag" | "resize",
  _originalItem?: LayoutItem,
): LayoutItem[] {
  if (interactionType === "resize") return items;

  // Phase 1: Vertical Cascade Push
  const sorted = items.toSorted((a, b) => a.y - b.y || a.x - b.x);

  if (activeItemId !== undefined) {
    const activeIdx = sorted.findIndex((item) => item.i === activeItemId);
    if (activeIdx > -1) {
      const [activeItem] = sorted.splice(activeIdx, 1);
      sorted.unshift(activeItem);
    }
  }

  const placed: LayoutItem[] = [];

  for (const item of sorted) {
    if (item.i === activeItemId) {
      placed.push({ ...item });
      continue;
    }

    let resolvedY = item.y;
    let hasCollision = true;

    while (hasCollision) {
      hasCollision = false;
      const temp = { ...item, y: resolvedY };

      for (const p of placed) {
        if (isOverlapping(temp, p)) {
          resolvedY = p.y + p.h;
          hasCollision = true;
          break;
        }
      }
    }

    placed.push({ ...item, y: resolvedY });
  }

  // Phase 2: Vertical Compaction
  placed.sort((a, b) => a.y - b.y || a.x - b.x);
  const compacted: LayoutItem[] = [];

  for (const item of placed) {
    if (item.i === activeItemId) {
      compacted.push(item);
      continue;
    }

    let compactedY = 0;
    let hasCollision = true;

    while (hasCollision) {
      hasCollision = false;
      const temp = { ...item, y: compactedY };

      for (const c of compacted) {
        if (isOverlapping(temp, c)) {
          compactedY = c.y + c.h;
          hasCollision = true;
          break;
        }
      }

      if (compactedY >= item.y) {
        compactedY = item.y;
        break;
      }
    }

    compacted.push({ ...item, y: compactedY });
  }

  return compacted;
}

export function clampToMin(item: LayoutItem): LayoutItem {
  const { minW, minH } = minCells(item);
  const x = Math.max(0, Math.min(item.x, GRID_COLS - minW));
  const y = Math.max(0, item.y);

  return {
    ...item,
    x,
    y,
    minW,
    minH,
    w: Math.min(Math.max(minW, item.w), GRID_COLS - x),
    h: Math.min(Math.max(minH, item.h), Math.max(minH, MAX_GRID_ROWS - y)),
  };
}
