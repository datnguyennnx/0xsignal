/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { pushBelow } from "./resize-push";
import type { LayoutItem } from "./types";

function item(i: string, x: number, y: number, w: number, h: number): LayoutItem {
  return { i, x, y, w, h };
}

describe("pushBelow", () => {
  test("a grown chart pushes the positions strip down", () => {
    const chart = item("chart", 0, 0, 16, 15);
    const positions = item("positions", 0, 11, 16, 5);

    const pushed = pushBelow([chart, positions], "chart", 4);

    expect(pushed).toEqual([chart, { ...positions, y: 15 }]);
    expect(positions.y).toBe(11);
  });

  test("a shrunk chart pulls the positions strip back up", () => {
    const chart = item("chart", 0, 0, 16, 13);
    const positions = item("positions", 0, 15, 16, 5);

    const pulled = pushBelow([chart, positions], "chart", -2);

    expect(pulled).toEqual([chart, { ...positions, y: 13 }]);
  });

  test("a neighbour without column overlap never moves", () => {
    const orderbook = item("orderbook", 16, 0, 5, 20);
    const orderform = item("orderform", 21, 0, 5, 16);

    const pushed = pushBelow([orderbook, orderform], "orderbook", 4);

    expect(pushed).toEqual([orderbook, orderform]);
  });

  test("two stacked neighbours shift by the same delta and keep their order", () => {
    const chart = item("chart", 0, 0, 16, 17);
    const upper = item("positions", 0, 11, 16, 5);
    const lower = item("orders", 0, 16, 16, 5);

    const pushed = pushBelow([chart, upper, lower], "chart", 6);

    expect(pushed).toEqual([chart, { ...upper, y: 17 }, { ...lower, y: 22 }]);
    expect(pushed[1].y + pushed[1].h).toBeLessThanOrEqual(pushed[2].y);
    expect(chart.y + chart.h).toBeLessThanOrEqual(pushed[1].y);
  });

  test("replaying the same delta is a no-op", () => {
    const chart = item("chart", 0, 0, 16, 15);
    const positions = item("positions", 0, 11, 16, 5);

    const once = pushBelow([chart, positions], "chart", 4);
    const twice = pushBelow(once, "chart", 4);

    expect(twice).toEqual(once);
  });

  test("a zero delta returns the same array reference", () => {
    const layout = [item("chart", 0, 0, 16, 11), item("positions", 0, 11, 16, 5)];

    expect(pushBelow(layout, "chart", 0)).toBe(layout);
  });

  test("pull-back never yields a negative row", () => {
    const chart = item("chart", 0, 0, 16, 5);
    const positions = item("positions", 0, 6, 16, 4);

    const pulled = pushBelow([chart, positions], "chart", -8);

    expect(pulled[1].y).toBe(5);
    expect(pulled.every((entry) => entry.y >= 0)).toBe(true);
  });
});
