/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { UserFill } from "@0xsignal/shared";

import { MAX_MERGED_FILLS, mergeUserFills } from "./user-stream-types";

const fill = (tid: number, time: number): UserFill => ({
  coin: "BTC",
  side: "B",
  sz: "1",
  px: "100",
  fee: "0",
  hash: `0x${tid.toString(16).padStart(64, "0")}`,
  oid: tid,
  tid,
  time,
});

const tids = (fills: readonly UserFill[]): number[] => fills.map((entry) => entry.tid);

describe("mergeUserFills", () => {
  test("caps a large descending batch to the newest MAX_MERGED_FILLS fills", () => {
    const descending = Array.from({ length: 2500 }, (_, index) =>
      fill(2500 - index, 2_500 - index),
    );

    const merged = mergeUserFills(undefined, { data: descending, isSnapshot: true });

    expect(merged.length).toBe(MAX_MERGED_FILLS);
    expect(merged[0]?.tid).toBe(2500);
    expect(merged.at(-1)?.tid).toBe(2500 - MAX_MERGED_FILLS + 1);
  });

  test("sorts an unsorted incoming batch newest-first on the update path", () => {
    const merged = mergeUserFills([], {
      data: [fill(1, 100), fill(3, 300), fill(2, 200)],
      isSnapshot: false,
    });

    expect(tids(merged)).toEqual([3, 2, 1]);
  });

  test("de-duplicates a tid that arrives again in a later batch", () => {
    const current = [fill(1, 100)];

    const merged = mergeUserFills(current, {
      data: [fill(2, 200), fill(1, 100)],
      isSnapshot: false,
    });

    expect(tids(merged)).toEqual([2, 1]);
  });

  test("caps a snapshot to the newest MAX_MERGED_FILLS fills", () => {
    const current = [fill(1, 1), fill(2, 2)];
    const snapshot = Array.from({ length: 2500 }, (_, index) => fill(index + 1, 1_000 + index));

    const merged = mergeUserFills(current, { data: snapshot, isSnapshot: true });

    expect(merged.length).toBe(MAX_MERGED_FILLS);
    expect(merged[0]?.tid).toBe(2500);
    expect(merged.at(-1)?.tid).toBe(2500 - MAX_MERGED_FILLS + 1);
  });

  test("keeps the old newest-first ordering when under the cap", () => {
    const current = [fill(4, 400), fill(3, 300), fill(1, 100)];

    const merged = mergeUserFills(current, { data: [fill(2, 200)], isSnapshot: false });
    expect(tids(merged)).toEqual([4, 3, 2, 1]);

    const tied = mergeUserFills([fill(1, 200)], { data: [fill(2, 200)], isSnapshot: false });
    expect(tids(tied)).toEqual([2, 1]);
  });
});
