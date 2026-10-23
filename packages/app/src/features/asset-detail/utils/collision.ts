import type { LayoutItem } from "./types";
import { GRID_COLS, MAX_GRID_ROWS, panelMin } from "./constants";

/**
 * NEW UNIT CONTRACT (S-6 fluid scaling): every width below is a FRACTION of
 * the container width (unitless, 0..1) — never pixels. Consumers must scale by
 * the container width or emit the value as a percentage / CSS `calc()`. No
 * caller subtracts a pixel gutter any more.
 */

/**
 * Inter-cell gutter as a fraction of container width — fluid analogue of the
 * legacy 8px GRID_GUTTER. It only equals 8px at a 1000px container
 * (0.008 * 1000 = 8); wider containers scale the gutter up, narrower down.
 */
export const GRID_GUTTER_FRACTION = 0.008;

/**
 * Per-column width as a fraction of the container width, gutters excluded.
 * At 12 columns and an 0.008 gutter each column spans
 * `(1 - 0.008 * 11) / 12` of the container.
 */
export function cellWidth(): number {
  return (1 - GRID_GUTTER_FRACTION * (GRID_COLS - 1)) / GRID_COLS;
}

/**
 * Snap a delta — expressed as a fraction of container width — to whole grid
 * units. `cellFraction` is a per-column fraction from `cellWidth()`.
 */
export function snapToGridUnits(fractionDelta: number, cellFraction: number): number {
  return Math.round(fractionDelta / (cellFraction + GRID_GUTTER_FRACTION));
}

/**
 * Effective minimum footprint. The declarative per-panel floor wins over whatever
 * a persisted item declares, so an old layout cannot unlock an unusable size.
 */
export function minCells(item: LayoutItem): { minW: number; minH: number } {
  const floor = panelMin(item.i);
  return {
    minW: Math.max(item.minW ?? 0, floor.minW),
    minH: Math.max(item.minH ?? 0, floor.minH),
  };
}

/**
 * Free corridor around a resizable item, as edge coordinates: the frame's left
 * edge may not pass `minX`, its right edge (`x + w`) not `maxX`, and likewise for
 * the vertical pair. Every handle clamps against these four values, so edges and
 * corners all consume one source of truth.
 */
export interface ResizeBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Derive `ResizeBounds` from the nearest neighbour edge on each side — never a sum
 * of minimums, and no rule that differs per axis: the two passes are the same test
 * transposed.
 *
 * A corner grows on both axes at once, so a neighbour is only clear of the frame
 * once it is outside the whole reachable corridor, not merely the current row or
 * column band. Bounds only ever tighten, so the passes repeat until they settle.
 */
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

/**
 * Resolve all grid collisions after a reposition.
 *
 * A resize frame is clamped against every neighbour before it is committed, so a
 * resize already produces a valid layout — resolving it would only move panels the
 * user did not touch. `_originalItem` stays in the signature for the caller.
 */
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
