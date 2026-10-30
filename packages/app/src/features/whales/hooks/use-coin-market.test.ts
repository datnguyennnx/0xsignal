/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import type { WhalePosition } from "@0xsignal/shared";

import {
  LADDER_MERGE_TOLERANCE_PCT,
  meaningfulSharePercent,
  mergeNearbyLevels,
  rankOnSide,
  sharePercent,
  sharePercentLabel,
  summarizeCoinMarket,
  trackedInterestAnchor,
} from "./use-coin-market";

const position = (overrides: Partial<WhalePosition> = {}): WhalePosition => ({
  userAddress: "0x0000000000000000000000000000000000000001",
  coin: "ETH",
  side: "buy",
  size: 1,
  notionalUsd: 1_000,
  entryPx: "2000",
  liquidationPx: "1500",
  markPrice: "2000",
  unrealizedPnl: 0,
  unrealizedPnlPct: 0,
  entryTime: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("summarizeCoinMarket", () => {
  test("partitions long and short notional with counts", () => {
    const summary = summarizeCoinMarket(
      [
        position({ side: "buy", notionalUsd: 300 }),
        position({ side: "buy", notionalUsd: 100 }),
        position({ side: "sell", notionalUsd: 600 }),
      ],
      null,
      1_000,
    );

    expect(summary.long).toEqual({ notional: 400, count: 2 });
    expect(summary.short).toEqual({ notional: 600, count: 1 });
  });

  test("sorts the ladder by distance to the passed mark and caps it after the band filter", () => {
    const summary = summarizeCoinMarket(
      [
        position({ side: "buy", liquidationPx: "200" }),
        position({ side: "buy", liquidationPx: "990" }),
        position({ side: "sell", liquidationPx: "2500" }),
        position({ side: "buy", liquidationPx: "950" }),
        position({ side: "buy", liquidationPx: "900" }),
        position({ side: "sell", liquidationPx: "1200" }),
        position({ side: "sell", liquidationPx: "1250" }),
        position({ side: "buy", liquidationPx: "700" }),
      ],
      null,
      1_000,
    );

    expect(summary.ladder.map((level) => level.price)).toEqual([990, 950, 900, 1200, 1250]);
  });

  test("drops ladder levels outside the band and keeps the boundary", () => {
    const summary = summarizeCoinMarket(
      [
        position({ side: "buy", liquidationPx: "500" }),
        position({ side: "sell", liquidationPx: "1350" }),
        position({ side: "sell", liquidationPx: "1300" }),
        position({ side: "buy", liquidationPx: "769" }),
      ],
      null,
      1_000,
    );

    expect(summary.ladder.map((level) => level.price)).toEqual([769, 1_300]);
  });

  test("carries side and notional on each ladder level", () => {
    const summary = summarizeCoinMarket(
      [
        position({ side: "sell", liquidationPx: "1200", notionalUsd: 250 }),
        position({ side: "buy", liquidationPx: "900", notionalUsd: 750 }),
      ],
      null,
      1_000,
    );

    expect(summary.ladder).toEqual([
      { price: 900, side: "buy", notional: 750 },
      { price: 1200, side: "sell", notional: 250 },
    ]);
  });

  test("merges same-side levels at the same price into one summed level", () => {
    const summary = summarizeCoinMarket(
      [
        position({ side: "buy", liquidationPx: "900", notionalUsd: 400 }),
        position({ side: "buy", liquidationPx: "900", notionalUsd: 600 }),
      ],
      null,
      1_000,
    );

    expect(summary.ladder).toEqual([{ price: 900, side: "buy", notional: 1_000 }]);
    expect(summary.ladder).toHaveLength(1);
  });

  test("sorts against the passed mark instead of each row's stale snapshot", () => {
    const staleMark = "500";
    const summary = summarizeCoinMarket(
      [
        position({ side: "sell", liquidationPx: "1100", markPrice: staleMark }),
        position({ side: "sell", liquidationPx: "1030", markPrice: staleMark }),
        position({ side: "buy", liquidationPx: "950", markPrice: staleMark }),
      ],
      null,
      1_000,
    );

    expect(summary.ladder.map((level) => level.price)).toEqual([1030, 950, 1100]);
  });

  test("drops a long level that sits above the mark", () => {
    const summary = summarizeCoinMarket(
      [position({ side: "buy", liquidationPx: "1100" })],
      null,
      1_000,
    );

    expect(summary.ladder).toEqual([]);
  });

  test("drops a short level that sits below the mark", () => {
    const summary = summarizeCoinMarket(
      [position({ side: "sell", liquidationPx: "900" })],
      null,
      1_000,
    );

    expect(summary.ladder).toEqual([]);
  });

  test("yields an empty ladder when the mark is missing or unusable", () => {
    const rows = [
      position({ side: "buy", liquidationPx: "900" }),
      position({ side: "sell", liquidationPx: "1100" }),
    ];

    expect(summarizeCoinMarket(rows, null, null).ladder).toEqual([]);
    expect(summarizeCoinMarket(rows, null, Number.NaN).ladder).toEqual([]);
    expect(summarizeCoinMarket(rows, null, 0).ladder).toEqual([]);
    expect(summarizeCoinMarket(rows, null, null).long).toEqual({ notional: 1_000, count: 1 });
  });

  test("drops rows without a usable liquidation price", () => {
    const summary = summarizeCoinMarket(
      [
        position({ liquidationPx: undefined }),
        position({ liquidationPx: "" }),
        position({ liquidationPx: "900" }),
      ],
      null,
      1_000,
    );

    expect(summary.ladder).toEqual([{ price: 900, side: "buy", notional: 1_000 }]);
  });

  test("flags truncation only when a next cursor is present", () => {
    const omittedPage: { nextCursor?: string | null } = {};

    expect(summarizeCoinMarket([], null, 1_000).truncated).toBe(false);
    expect(summarizeCoinMarket([], omittedPage.nextCursor, 1_000).truncated).toBe(false);
    expect(summarizeCoinMarket([], "cursor-2", 1_000).truncated).toBe(true);
  });

  test("keeps both sides at zero and yields no share when nothing is tracked", () => {
    const summary = summarizeCoinMarket([], null, 1_000);

    expect(summary.long).toEqual({ notional: 0, count: 0 });
    expect(summary.short).toEqual({ notional: 0, count: 0 });
    expect(
      sharePercent(summary.long.notional, summary.long.notional + summary.short.notional),
    ).toBeNull();
  });
});

describe("sharePercent", () => {
  test("returns the part as a percentage of the total", () => {
    expect(sharePercent(25, 100)).toBe(25);
    expect(sharePercent(600, 1_000)).toBeCloseTo(60);
  });

  test("returns null for a zero or non-finite denominator", () => {
    expect(sharePercent(0, 0)).toBeNull();
    expect(sharePercent(10, Number.NaN)).toBeNull();
  });
});

describe("meaningfulSharePercent", () => {
  test("returns the share when it is at least one percent", () => {
    expect(meaningfulSharePercent(12.4, 100)).toBeCloseTo(12.4);
    expect(meaningfulSharePercent(1, 100)).toBeCloseTo(1);
  });

  test("returns null when the share falls below one percent", () => {
    expect(meaningfulSharePercent(0.4, 100)).toBeNull();
    expect(meaningfulSharePercent(534.78, 3_540_000)).toBeNull();
  });
});

describe("split share floor", () => {
  test("drops the split segment whose raw share rounds to 0.0%", () => {
    const long = 500;
    const total = long + 3_540_000;

    expect(sharePercent(long, total)?.toFixed(1)).toBe("0.0");
    expect(meaningfulSharePercent(long, total)).toBeNull();
  });
});

describe("sharePercentLabel", () => {
  test("prints an em dash when the share is unknown", () => {
    expect(sharePercentLabel(null)).toBe("—");
    expect(sharePercentLabel(Number.NaN)).toBe("—");
  });

  test("floors a side under one percent instead of printing 0.0%", () => {
    expect(sharePercentLabel(0.0141)).toBe("<1%");
  });

  test("keeps one decimal at and above the floor", () => {
    expect(sharePercentLabel(1)).toBe("1.0%");
    expect(sharePercentLabel(79.63)).toBe("79.6%");
  });

  test("derives each side from its own notional instead of subtracting", () => {
    const long = 500;
    const short = 3_540_000;
    const total = long + short;

    expect(sharePercentLabel(sharePercent(long, total))).toBe("<1%");
    expect(sharePercentLabel(sharePercent(short, total))).toBe("99.9%");
  });
});

describe("trackedInterestAnchor", () => {
  test("compares the dominant tracked side against one-sided open interest", () => {
    expect(trackedInterestAnchor(253_030_000, 790_500_000, 3_351_019_975)).toBe(
      "Tracked shorts hold 23.6% of open interest",
    );
    expect(trackedInterestAnchor(300, 100, 1_000)).toBe(
      "Tracked longs hold 30.0% of open interest",
    );
  });

  test("stays bounded where summing both sides would exceed 100%", () => {
    const long = 60;
    const short = 80;
    const openInterestUsd = 100;

    expect(((long + short) / openInterestUsd) * 100).toBeGreaterThan(100);
    expect(trackedInterestAnchor(long, short, openInterestUsd)).toBe(
      "Tracked shorts hold 80.0% of open interest",
    );
  });

  test("floors a sub-percent share and omits the line without open interest", () => {
    expect(trackedInterestAnchor(400, 100, 1_000_000)).toBe(
      "Tracked longs hold <1% of open interest",
    );
    expect(trackedInterestAnchor(400, 100, null)).toBeNull();
    expect(trackedInterestAnchor(400, 100, 0)).toBeNull();
  });
});

describe("mergeNearbyLevels", () => {
  const MARK = 78_571;

  test("merges three nearby same-side levels into one summed, weighted level", () => {
    const merged = mergeNearbyLevels(
      [
        { price: 78_087, side: "buy", notional: 1_000_000 },
        { price: 78_030, side: "buy", notional: 600_000 },
        { price: 77_990, side: "buy", notional: 310_000 },
      ],
      MARK,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.notional).toBe(1_910_000);
    expect(merged[0]?.count).toBe(3);
    expect(merged[0]?.price).toBeCloseTo(
      (78_087 * 1_000_000 + 78_030 * 600_000 + 77_990 * 310_000) / 1_910_000,
      6,
    );
  });

  test("keeps a level outside the tolerance separate", () => {
    const merged = mergeNearbyLevels(
      [
        { price: 78_087, side: "buy", notional: 1_000_000 },
        { price: 77_800, side: "buy", notional: 250_000 },
      ],
      MARK,
    );

    expect(merged.map((level) => level.price)).toEqual([78_087, 77_800]);
    expect(merged.map((level) => level.count)).toEqual([1, 1]);
    expect(LADDER_MERGE_TOLERANCE_PCT).toBe(0.0015);
  });

  test("never merges opposite sides at the same price", () => {
    const merged = mergeNearbyLevels(
      [
        { price: 78_030, side: "buy", notional: 500_000 },
        { price: 78_030, side: "sell", notional: 700_000 },
      ],
      MARK,
    );

    expect(merged).toEqual([
      { price: 78_030, side: "buy", notional: 500_000, count: 1 },
      { price: 78_030, side: "sell", notional: 700_000, count: 1 },
    ]);
  });

  test("returns a single level unchanged with a count of one", () => {
    expect(mergeNearbyLevels([{ price: 76_000, side: "buy", notional: 420_000 }], MARK)).toEqual([
      { price: 76_000, side: "buy", notional: 420_000, count: 1 },
    ]);
  });

  test("returns an empty array for an empty ladder", () => {
    expect(mergeNearbyLevels([], MARK)).toEqual([]);
  });
});

describe("rankOnSide", () => {
  const whale = "0x00000000000000000000000000000000000000aa";
  const peer = "0x00000000000000000000000000000000000000bb";
  const small = "0x00000000000000000000000000000000000000cc";

  test("ranks the largest notional on a side first and reports the side count", () => {
    const rows = [
      position({ userAddress: whale, side: "sell", notionalUsd: 900 }),
      position({ userAddress: peer, side: "sell", notionalUsd: 500 }),
      position({ userAddress: small, side: "sell", notionalUsd: 100 }),
      position({ userAddress: peer, side: "buy", notionalUsd: 5_000 }),
    ];

    expect(rankOnSide(rows, whale)).toEqual({ rank: 1, count: 3, side: "sell", notional: 900 });
    expect(rankOnSide(rows, small)).toEqual({ rank: 3, count: 3, side: "sell", notional: 100 });
  });

  test("gives tied notionals the same rank", () => {
    const rows = [
      position({ userAddress: whale, side: "buy", notionalUsd: 500 }),
      position({ userAddress: peer, side: "buy", notionalUsd: 500 }),
      position({ userAddress: small, side: "buy", notionalUsd: 100 }),
    ];

    expect(rankOnSide(rows, whale)?.rank).toBe(1);
    expect(rankOnSide(rows, peer)?.rank).toBe(1);
    expect(rankOnSide(rows, small)?.rank).toBe(3);
  });

  test("aggregates a whale's rows on the side it holds", () => {
    const rows = [
      position({ userAddress: whale, side: "buy", notionalUsd: 400 }),
      position({ userAddress: whale, side: "buy", notionalUsd: 400 }),
      position({ userAddress: peer, side: "buy", notionalUsd: 700 }),
    ];

    expect(rankOnSide(rows, whale)).toEqual({ rank: 1, count: 2, side: "buy", notional: 800 });
  });

  test("counts distinct whales on a side rather than rows", () => {
    const rows = [
      position({ userAddress: whale, side: "buy", notionalUsd: 100 }),
      position({ userAddress: whale, side: "buy", notionalUsd: 100 }),
      position({ userAddress: peer, side: "buy", notionalUsd: 900 }),
      position({ userAddress: peer, side: "buy", notionalUsd: 50 }),
    ];

    expect(rankOnSide(rows, whale)).toEqual({ rank: 2, count: 2, side: "buy", notional: 200 });
  });

  test("returns null when the whale holds no position", () => {
    const rows = [position({ userAddress: peer, side: "buy", notionalUsd: 500 })];

    expect(rankOnSide(rows, whale)).toBeNull();
  });
});
