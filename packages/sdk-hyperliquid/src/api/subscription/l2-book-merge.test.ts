import { expect, test } from "bun:test";
import { mergeL2Book, type BookFrame, type BookLevel } from "./l2-book-merge";

const level = (px: string): BookLevel => ({
  px: px as BookLevel["px"],
  sz: "1" as BookLevel["sz"],
  n: 1,
});

const frame = (coin: string, time: number, bids: string[], asks: string[]): BookFrame => ({
  coin,
  time,
  levels: [bids.map(level), asks.map(level)],
});

test("the subscription surface merges through the canonical primitive", () => {
  const merged = mergeL2Book(frame("BTC", 1_000, ["2", "1"], ["3", "4"]), null, 1, 1_000);

  expect(merged).not.toBeNull();
  expect(merged?.degraded).toEqual(["slow"]);
  expect(merged?.levels[0].map((entry) => String(entry.px))).toEqual(["2"]);
});
