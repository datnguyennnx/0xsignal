/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";

import { useLayoutStore } from "@/stores/use-layout-store";
import { canvasRowCount } from "@/features/asset-detail/utils/resize-push";
import { MAX_GRID_ROWS, panelMin } from "@/features/asset-detail/utils/constants";
import type { LayoutItem } from "@/features/asset-detail/utils/types";

function item(i: string, x: number, y: number, w: number, h: number): LayoutItem {
  return { i, x, y, w, h };
}

function seed(items: LayoutItem[]): void {
  useLayoutStore.setState({ items });
}

function current(): LayoutItem[] {
  return useLayoutStore.getState().items;
}

function find(id: string): LayoutItem {
  const match = current().find((entry) => entry.i === id);
  if (match === undefined) throw new Error(`missing ${id}`);
  return match;
}

function resized(id: string, h: number): LayoutItem[] {
  return current().map((entry) => (entry.i === id ? { ...entry, h } : entry));
}

function hasColumnOverlap(items: LayoutItem[]): boolean {
  for (let a = 0; a < items.length; a += 1) {
    for (let b = a + 1; b < items.length; b += 1) {
      const p = items[a];
      const q = items[b];
      const columns = p.x < q.x + q.w && p.x + p.w > q.x;
      const rows = p.y < q.y + q.h && p.y + p.h > q.y;
      if (columns && rows) return true;
    }
  }
  return false;
}

beforeEach(() => {
  seed([]);
});

describe("resize commit", () => {
  test("pushes only the column below the resized panel", () => {
    const orderform = item("orderform", 21, 0, 5, 16);
    seed([item("orderbook", 16, 0, 5, 16), orderform]);
    const before = canvasRowCount(current());

    useLayoutStore.getState().commitLayout(resized("orderbook", 20), "orderbook", "resize");

    expect(find("orderbook").h).toBe(20);
    expect(find("orderform")).toEqual(orderform);
    expect(canvasRowCount(current())).toBeGreaterThan(before);
  });

  test("grows then shrinks the panel below by the same delta", () => {
    seed([item("chart", 0, 0, 16, 11), item("positions", 0, 11, 16, 5)]);

    useLayoutStore.getState().commitLayout(resized("chart", 15), "chart", "resize");
    expect(find("positions").y).toBe(15);

    useLayoutStore.getState().commitLayout(resized("chart", 13), "chart", "resize");
    expect(find("positions").y).toBe(13);
  });

  test("persists growth past the default canvas height", () => {
    seed([item("chart", 0, 0, 16, 11), item("positions", 0, 11, 16, 5)]);

    useLayoutStore.getState().commitLayout(resized("chart", 40), "chart", "resize");

    expect(find("chart").h).toBe(40);
    expect(find("chart").h).toBeGreaterThan(MAX_GRID_ROWS);
    expect(find("positions").y).toBe(40);
  });

  test("re-committing the same layout is idempotent", () => {
    seed([item("chart", 0, 0, 16, 11), item("positions", 0, 11, 16, 5)]);

    useLayoutStore.getState().commitLayout(resized("chart", 15), "chart", "resize");
    const once = current();

    useLayoutStore.getState().commitLayout(current(), "chart", "resize");

    expect(current()).toEqual(once);
    expect(find("positions").y).toBe(15);
  });

  test("keeps every panel at or above its minimum without column overlaps", () => {
    seed([
      item("chart", 0, 0, 16, 11),
      item("orderbook", 16, 0, 5, 16),
      item("orderform", 21, 0, 5, 16),
      item("positions", 0, 11, 16, 5),
    ]);

    useLayoutStore.getState().commitLayout(resized("chart", 40), "chart", "resize");
    useLayoutStore.getState().commitLayout(resized("orderbook", 24), "orderbook", "resize");

    const stored = current();
    for (const entry of stored) {
      expect(entry.h).toBeGreaterThanOrEqual(panelMin(entry.i).minH);
    }
    expect(hasColumnOverlap(stored)).toBe(false);
  });
});

describe("drag commit", () => {
  test("still cascades colliding panels and never overlaps", () => {
    seed([item("chart", 0, 0, 16, 11), item("positions", 0, 11, 16, 5)]);
    const dragged = current().map((entry) =>
      entry.i === "positions" ? { ...entry, y: 0 } : entry,
    );

    useLayoutStore.getState().commitLayout(dragged, "positions", "drag");

    expect(find("positions").y).toBe(0);
    expect(find("chart").y).toBe(5);
    expect(hasColumnOverlap(current())).toBe(false);
  });
});
