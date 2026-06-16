import type { LayoutItem } from "./types";
import { GRID_COLS, GRID_GUTTER } from "./constants";

// Grid Snapping & Pixels

export function snapToGridUnits(pixelDelta: number, cellSize: number): number {
  const unitSize = cellSize + GRID_GUTTER;
  return Math.round(pixelDelta / unitSize);
}

export function cellWidth(containerWidth: number): number {
  return (containerWidth - GRID_GUTTER * (GRID_COLS - 1)) / GRID_COLS;
}

// Collision Constraints

/**
 * Compute resize constraints.
 *
 * Horizontal: maxW and minX are derived from the aggregate minW
 * of neighbors in the same row band — allowing fluid co-resizing
 * where neighbors shrink to their minW to make room.
 *
 * Vertical: maxH = Infinity (cascade push handles it).
 * minY is clamped by the bottom edge of items directly above.
 */
export function getResizeConstraints(
  item: LayoutItem,
  others: LayoutItem[]
): { maxW: number; maxH: number; minX: number; minY: number } {
  const maxH = Infinity;
  let minY = 0;

  let rightMinWTotal = 0;
  let leftMinWTotal = 0;

  for (const other of others) {
    if (other.i === item.i) continue;

    const verticalOverlap = item.y < other.y + other.h && item.y + item.h > other.y;

    if (verticalOverlap) {
      // Right neighbor: can shrink to its minW
      if (other.x >= item.x) {
        rightMinWTotal += other.minW ?? 1;
      }
      // Left neighbor: can shrink to its minW
      if (other.x + other.w <= item.x) {
        leftMinWTotal += other.minW ?? 1;
      }
    }

    // Top-edge constraint for n/nw/ne handles
    const horizontalOverlap = item.x < other.x + other.w && item.x + item.w > other.x;
    if (other.y + other.h <= item.y + item.h && horizontalOverlap) {
      const topEdge = other.y + other.h;
      if (topEdge > minY) minY = topEdge;
    }
  }

  // maxW: grid columns to the right minus what right neighbors need at minimum
  const maxW = Math.max(item.minW ?? 1, GRID_COLS - item.x - rightMinWTotal);

  // minX: left neighbors need at least their minW space
  const minX = Math.max(0, leftMinWTotal);

  return { maxW, maxH, minX, minY };
}

// Collision Detection

function isOverlapping(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Horizontal Row-Band Redistribution

/**
 * Redistribute widths within the active item's row band during resize.
 *
 * The active item keeps its x and w (anchored). Left-side items
 * fill from x=0 to active.x proportional to their current widths.
 * Right-side items fill from active.x+active.w to GRID_COLS.
 *
 * If constraints can't be satisfied (minW violations), the active
 * item's x or w is clamped.
 */
function redistributeRowBand(
  items: LayoutItem[],
  activeItemId: string,
  originalItem?: LayoutItem
): LayoutItem[] {
  const result = items.map((i) => ({ ...i }));
  const active = result.find((i) => i.i === activeItemId);
  if (!active) return result;

  // Guard 1: Skip if width and x-position didn't change (height-only resize)
  if (originalItem && active.w === originalItem.w && active.x === originalItem.x) {
    return result;
  }

  // Guard 2: Use the ORIGINAL vertical range for row-band matching.
  // This prevents items that were below the active widget before resize
  // from being pulled into the redistribution band when height grows.
  const rowTop = originalItem?.y ?? active.y;
  const rowBottom = originalItem ? originalItem.y + originalItem.h : active.y + active.h;

  // Find row band — items vertically overlapping with active
  const band = result.filter((i) => i.y < rowBottom && i.y + i.h > rowTop);

  // Early exit: if the row band has no horizontal conflicts, do nothing.
  // This prevents width redistribution on height-only resizes.
  const anyOverlap = band.some((a, ai) => band.some((b, bi) => ai !== bi && isOverlapping(a, b)));
  const anyOverflow = band.some((i) => i.x + i.w > GRID_COLS || i.x < 0);

  if (!anyOverlap && !anyOverflow) {
    return result; // Layout is valid — no redistribution needed
  }

  // Sort left-to-right
  band.sort((a, b) => a.x - b.x);

  const activeIdx = band.findIndex((i) => i.i === activeItemId);
  const leftItems = band.slice(0, activeIdx);
  const rightItems = band.slice(activeIdx + 1);

  // Enforce constraints

  const leftMinTotal = leftItems.reduce((s, i) => s + (i.minW ?? 1), 0);
  const rightMinTotal = rightItems.reduce((s, i) => s + (i.minW ?? 1), 0);

  // If left items need more space than active.x allows, push active right
  if (leftMinTotal > active.x) {
    active.x = leftMinTotal;
  }

  // If right items don't fit, clamp active.w
  const maxActiveW = GRID_COLS - active.x - rightMinTotal;
  if (active.w > maxActiveW) {
    active.w = Math.max(active.minW ?? 1, maxActiveW);
  }

  // Distribute left side: fill from 0 to active.x

  if (leftItems.length > 0) {
    let cursor = 0;
    const leftTotalW = leftItems.reduce((s, i) => s + i.w, 0);
    const spaceForLeft = active.x;

    for (let i = 0; i < leftItems.length; i++) {
      const ref = result.find((r) => r.i === leftItems[i].i)!;
      ref.x = cursor;

      if (i === leftItems.length - 1) {
        // Last left item: fill remaining space to active.x
        ref.w = Math.max(ref.minW ?? 1, active.x - cursor);
      } else {
        // Proportional distribution
        const proportion = leftTotalW > 0 ? leftItems[i].w / leftTotalW : 1 / leftItems.length;
        ref.w = Math.max(ref.minW ?? 1, Math.round(proportion * spaceForLeft));
      }
      cursor += ref.w;
    }

    // Clamp last left item to not overshoot
    const lastLeft = result.find((r) => r.i === leftItems[leftItems.length - 1].i)!;
    if (lastLeft.x + lastLeft.w > active.x) {
      lastLeft.w = active.x - lastLeft.x;
    }
  }

  // Distribute right side: fill from active end to GRID_COLS

  if (rightItems.length > 0) {
    let cursor = active.x + active.w;
    const spaceForRight = GRID_COLS - cursor;
    const rightTotalW = rightItems.reduce((s, i) => s + i.w, 0);

    for (let i = 0; i < rightItems.length; i++) {
      const ref = result.find((r) => r.i === rightItems[i].i)!;
      ref.x = cursor;

      if (i === rightItems.length - 1) {
        // Last right item: fill remaining space to grid edge
        ref.w = Math.max(ref.minW ?? 1, GRID_COLS - cursor);
      } else {
        const proportion = rightTotalW > 0 ? rightItems[i].w / rightTotalW : 1 / rightItems.length;
        ref.w = Math.max(ref.minW ?? 1, Math.round(proportion * spaceForRight));
      }
      cursor += ref.w;
    }
  }

  // Clamp all items within grid bounds

  for (const item of result) {
    item.x = Math.max(0, item.x);
    item.w = Math.max(item.minW ?? 1, Math.min(item.w, GRID_COLS - item.x));
  }

  return result;
}

// Collision Resolution

/**
 * Resolve all grid collisions.
 *
 * @param items - Current layout items.
 * @param activeItemId - The widget being dragged/resized (anchored).
 * @param interactionType - 'drag' (vertical push only) or 'resize'
 *   (horizontal row-band redistribution + vertical push).
 */
export function resolveCollisions(
  items: LayoutItem[],
  activeItemId?: string,
  interactionType?: "drag" | "resize",
  originalItem?: LayoutItem
): LayoutItem[] {
  // Phase 0: Horizontal row-band redistribution (resize only)
  let working = [...items];
  if (interactionType === "resize" && activeItemId) {
    working = redistributeRowBand(working, activeItemId, originalItem);
  }

  // Phase 1: Vertical Cascade Push
  const sorted = [...working].sort((a, b) => a.y - b.y || a.x - b.x);

  if (activeItemId) {
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
  return {
    ...item,
    w: Math.max(item.minW ?? 1, item.w),
    h: Math.max(item.minH ?? 1, item.h),
  };
}
