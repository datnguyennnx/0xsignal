import { describe, expect, test } from "bun:test";
import { asDecimal } from "../core/brands";
import {
  DEFAULT_BOOK_DEPTH,
  FAST_DROP_MS,
  FAST_STALE_MS,
  SLOW_DROP_MS,
  SLOW_STALE_MS,
  mergeL2Book,
} from "./l2-book";
import type { BookFrame, BookLevel } from "./l2-book";

const level = (px: string): BookLevel => ({ px: asDecimal(px), sz: asDecimal("1"), n: 1 });

const cents = (values: readonly number[]): string[] =>
  values.map((value) => (value / 100).toFixed(2));

const frame = (coin: string, time: number, bids: string[], asks: string[]): BookFrame => ({
  coin,
  time,
  levels: [bids.map(level), asks.map(level)],
});

const px = (levels: readonly BookLevel[]): string[] => levels.map((entry) => entry.px);

const expectDescending = (values: readonly string[]): void => {
  for (let i = 1; i < values.length; i += 1) {
    const previous = values[i - 1];
    const current = values[i];
    if (previous === undefined || current === undefined) throw new Error("missing price");
    expect(Number(current)).toBeLessThan(Number(previous));
  }
};

const expectAscending = (values: readonly string[]): void => {
  for (let i = 1; i < values.length; i += 1) {
    const previous = values[i - 1];
    const current = values[i];
    if (previous === undefined || current === undefined) throw new Error("missing price");
    expect(Number(current)).toBeGreaterThan(Number(previous));
  }
};

const ascendingRange = (start: number, count: number): number[] =>
  Array.from({ length: count }, (_, index) => start + index);

const T1 = 1_000_000;
const T2 = 1_003_000;

const fastBids = cents([21085, 21084, 21016, 21015, 21012]);
const fastAsks = cents([21110, 21121, 21130, 21134, 21141]);
const slowBids = cents(ascendingRange(21066, 20).reverse());
const slowAsks = cents(ascendingRange(21110, 20));

const unionBids = [...slowBids, ...fastBids.slice(2)];
const unionAsks = [...slowAsks, ...fastAsks.slice(2)];

const fast = frame("BTC", T2, fastBids, fastAsks);
const slow = frame("BTC", T1, slowBids, slowAsks);

const merged = (value: ReturnType<typeof mergeL2Book>): NonNullable<typeof value> => {
  if (value === null) throw new Error("expected a merged book");
  return value;
};

describe("mergeL2Book ordered union", () => {
  test("unions the captured fast and slow legs without holes", () => {
    const book = merged(mergeL2Book(fast, slow, 40, T2));

    expect(px(book.levels[0])).toEqual(unionBids);
    expect(px(book.levels[1])).toEqual(unionAsks);
    expect(book.levels[0]).toHaveLength(Math.min(unionBids.length, 40));
    expect(book.levels[1]).toHaveLength(Math.min(unionAsks.length, 40));
    expectDescending(px(book.levels[0]));
    expectAscending(px(book.levels[1]));
    expect(book.time).toBe(T2);
    expect(book.degraded).toEqual([]);
  });

  test("caps each side at the default depth with the union prefix", () => {
    const book = merged(mergeL2Book(fast, slow, DEFAULT_BOOK_DEPTH, T2));

    expect(px(book.levels[0])).toEqual(unionBids.slice(0, DEFAULT_BOOK_DEPTH));
    expect(px(book.levels[1])).toEqual(unionAsks.slice(0, DEFAULT_BOOK_DEPTH));
    expect(book.levels[0]).toHaveLength(DEFAULT_BOOK_DEPTH);
    expect(book.levels[1]).toHaveLength(DEFAULT_BOOK_DEPTH);
    expectDescending(px(book.levels[0]));
    expectAscending(px(book.levels[1]));
    expect(book.degraded).toEqual([]);
  });

  test("keeps a slow level that falls inside a fast price hole", () => {
    const book = merged(mergeL2Book(fast, slow, 40, T2));
    const prices = px(book.levels[0]);

    const index = prices.indexOf("210.83");
    expect(index).toBeGreaterThan(-1);
    expect(prices[index - 1]).toBe("210.84");
    expect(prices[index + 1]).toBe("210.82");
  });

  test("dedupes an equal price onto the fast level object", () => {
    const book = merged(mergeL2Book(fast, slow, 40, T2));

    expect(px(book.levels[0]).filter((entry) => entry === "210.85")).toHaveLength(1);
    expect(book.levels[0][0]).toBe(fast.levels[0][0]);

    const askPrices = px(book.levels[1]);
    const askIndex = askPrices.indexOf("211.21");
    expect(askPrices.filter((entry) => entry === "211.21")).toHaveLength(1);
    expect(book.levels[1][askIndex]).toBe(fast.levels[1][1]);
  });

  test("reuses the input level objects by reference", () => {
    const book = merged(mergeL2Book(fast, slow, 40, T2));

    expect(book.levels[0][0]).toBe(fast.levels[0][0]);
    expect(book.levels[0][1]).toBe(fast.levels[0][1]);
    expect(book.levels[0][2]).toBe(slow.levels[0][2]);
    expect(book.levels[1][0]).toBe(fast.levels[1][0]);
  });
});

describe("mergeL2Book degraded legs", () => {
  test("a slow-only book is truncated and marks fast degraded", () => {
    const book = merged(mergeL2Book(null, slow, DEFAULT_BOOK_DEPTH, T1));

    expect(px(book.levels[0])).toEqual(slowBids);
    expect(px(book.levels[1])).toEqual(slowAsks);
    expect(book.degraded).toEqual(["fast"]);
    expect(book.time).toBe(T1);
  });

  test("a fast-only book keeps five levels and marks slow degraded", () => {
    const book = merged(mergeL2Book(fast, null, DEFAULT_BOOK_DEPTH, T2));

    expect(px(book.levels[0])).toEqual(fastBids);
    expect(px(book.levels[1])).toEqual(fastAsks);
    expect(book.degraded).toEqual(["slow"]);
    expect(book.time).toBe(T2);
  });

  test("a soft-stale slow leg stays usable and is marked degraded", () => {
    const now = T1 + SLOW_STALE_MS + 1_000;
    const recentFast = frame("BTC", now - 500, fastBids, fastAsks);
    const book = merged(mergeL2Book(recentFast, slow, DEFAULT_BOOK_DEPTH, now));

    expect(book.levels[0]).toHaveLength(DEFAULT_BOOK_DEPTH);
    expect(book.levels[1]).toHaveLength(DEFAULT_BOOK_DEPTH);
    expect(px(book.levels[0])).toEqual(unionBids.slice(0, DEFAULT_BOOK_DEPTH));
    expect(book.degraded).toEqual(["slow"]);
  });

  test("a hard-stale slow leg is dropped and the fast book survives", () => {
    const now = T1 + SLOW_DROP_MS + 1_000;
    const recentFast = frame("BTC", now - 500, fastBids, fastAsks);
    const book = merged(mergeL2Book(recentFast, slow, DEFAULT_BOOK_DEPTH, now));

    expect(px(book.levels[0])).toEqual(fastBids);
    expect(px(book.levels[1])).toEqual(fastAsks);
    expect(book.degraded).toEqual(["slow"]);
    expect(book.time).toBe(recentFast.time);
  });

  test("a soft-stale fast leg stays usable and is marked degraded", () => {
    const now = T2 + FAST_STALE_MS + 500;
    const recentSlow = frame("BTC", now - 500, slowBids, slowAsks);
    const book = merged(mergeL2Book(fast, recentSlow, DEFAULT_BOOK_DEPTH, now));

    expect(book.levels[0]).toHaveLength(DEFAULT_BOOK_DEPTH);
    expect(book.levels[1]).toHaveLength(DEFAULT_BOOK_DEPTH);
    expect(book.degraded).toEqual(["fast"]);
    expect(book.levels[0][0]).toBe(fast.levels[0][0]);
  });

  test("a hard-stale fast leg is dropped and the slow book survives", () => {
    const now = T2 + FAST_DROP_MS + 1_000;
    const recentSlow = frame("BTC", now - 500, slowBids, slowAsks);
    const book = merged(mergeL2Book(fast, recentSlow, DEFAULT_BOOK_DEPTH, now));

    expect(book.levels[0]).toHaveLength(DEFAULT_BOOK_DEPTH);
    expect(book.degraded).toEqual(["fast"]);
    expect(book.time).toBe(recentSlow.time);
    expect(book.levels[0][0]).toBe(recentSlow.levels[0][0]);
  });

  test("an inverted fast leg is dropped rather than sorted", () => {
    const misordered = frame("BTC", T2, [...fastBids].reverse(), fastAsks);
    const book = merged(mergeL2Book(misordered, slow, DEFAULT_BOOK_DEPTH, T2));

    expect(px(book.levels[0])).toEqual(slowBids);
    expect(px(book.levels[1])).toEqual(slowAsks);
    expect(book.degraded).toEqual(["fast"]);
  });

  test("replacing a validated slow frame with misordered levels is rejected", () => {
    const orderedSlow = frame("BTC", T1, slowBids, slowAsks);
    const first = merged(mergeL2Book(fast, orderedSlow, DEFAULT_BOOK_DEPTH, T2));
    expect(first.degraded).toEqual([]);

    const misorderedSlow = frame("BTC", T1, slowAsks, slowBids);
    const second = merged(mergeL2Book(fast, misorderedSlow, DEFAULT_BOOK_DEPTH, T2));

    expect(second.degraded).toEqual(["slow"]);
    expect(px(second.levels[0])).toEqual(fastBids);
    expect(px(second.levels[1])).toEqual(fastAsks);
  });

  test("a duplicate price inside one leg does not reject the leg", () => {
    const duplicateBids = [...slowBids.slice(0, 1), ...slowBids];
    const duplicated = frame("BTC", T1, duplicateBids, slowAsks);
    const book = merged(mergeL2Book(fast, duplicated, 40, T2));

    expect(book.degraded).toEqual([]);
    expect(px(book.levels[0])).toEqual(unionBids);
    expect(new Set(px(book.levels[0])).size).toBe(px(book.levels[0]).length);
    expect(px(book.levels[1])).toEqual(unionAsks);
  });

  test("does not re-walk an unchanged leg's ordering on later merges", () => {
    let pxReads = 0;
    const counted = (px: string): BookLevel => ({
      get px() {
        pxReads += 1;
        return asDecimal(px);
      },
      sz: asDecimal("1"),
      n: 1,
    });
    const countedFrame = (time: number, bidPx: string[], askPx: string[]): BookFrame => ({
      coin: "BTC",
      time,
      levels: [bidPx.map(counted), askPx.map(counted)],
    });
    const countedFast = countedFrame(T2, fastBids, fastAsks);
    const countedSlow = countedFrame(T1, slowBids, slowAsks);

    merged(mergeL2Book(countedFast, countedSlow, 0, T2));
    const afterFirst = pxReads;
    expect(afterFirst).toBeGreaterThan(0);

    merged(mergeL2Book(countedFast, countedSlow, 0, T2));
    expect(pxReads).toBe(afterFirst);
  });

  test("both legs absent yields null", () => {
    expect(mergeL2Book(null, null, DEFAULT_BOOK_DEPTH, T2)).toBeNull();
  });
});

describe("mergeL2Book constants", () => {
  test("soft, hard and default thresholds are exposed", () => {
    expect(FAST_STALE_MS).toBe(1500);
    expect(SLOW_STALE_MS).toBe(8000);
    expect(FAST_DROP_MS).toBe(60000);
    expect(SLOW_DROP_MS).toBe(60000);
    expect(DEFAULT_BOOK_DEPTH).toBe(20);
  });
});
