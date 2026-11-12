import type { LayoutItem } from "./types";

function overlapsColumns(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

/**
 * Displaces the neighbours a resize would collide with. Idempotence comes from
 * the band: an item only moves while its top sits in the rows the resize
 * gained (or vacated), and a pushed item's top lands on or past the new
 * bottom, outside the band, so a second identical call is a no-op.
 */
export function pushBelow(
  items: readonly LayoutItem[],
  activeId: string,
  deltaRows: number,
): readonly LayoutItem[] {
  const active = items.find((item) => item.i === activeId);
  if (active === undefined || deltaRows === 0) return items;

  const activeBottom = active.y + active.h;
  const previousBottom = activeBottom - deltaRows;
  const bandStart = Math.min(activeBottom, previousBottom);
  const bandEnd = Math.max(activeBottom, previousBottom);

  const displaced = items
    .filter((item) => {
      if (item.i === activeId || !overlapsColumns(item, active)) return false;
      if (item.y < bandStart) return false;
      return deltaRows > 0 ? item.y < bandEnd : item.y <= bandEnd;
    })
    .toSorted((a, b) => a.y - b.y || a.x - b.x);

  if (displaced.length === 0) return items;

  const shiftedY = new Map<string, number>();
  let cursor = activeBottom;
  for (const item of displaced) {
    const y = Math.max(cursor, item.y + deltaRows);
    shiftedY.set(item.i, y);
    cursor = y + item.h;
  }

  return items.map((item) => {
    const y = shiftedY.get(item.i);
    return y === undefined ? item : { ...item, y };
  });
}
