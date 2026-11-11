/// <reference types="bun-types" />
import { describe, expect, mock, test } from "bun:test";

import type { AssetCtxSnapshot } from "../lib/asset-ctx";
import type { AssetCtxStream } from "../lib/asset-ctx-stream";
import { createCtxBuffer, createVisibleCoinsSync, visibleCoinsKey } from "./use-visible-asset-ctx";

const createFakeStream = () => {
  const setVisible = mock((_coins: readonly string[]): void => undefined);
  const dispose = mock((): void => undefined);
  const stream: AssetCtxStream = { setVisible, dispose };
  return { stream, setVisible, dispose };
};

describe("visibleCoinsKey", () => {
  test("is stable across calls and across a fresh array with the same coins", () => {
    expect(visibleCoinsKey(["A", "B"])).toBe(visibleCoinsKey(["A", "B"]));
    expect(visibleCoinsKey(["A", "B"])).toBe(visibleCoinsKey(["A", "B"]));
  });

  test("is order-sensitive: reordering changes the key", () => {
    expect(visibleCoinsKey(["A", "B"])).not.toBe(visibleCoinsKey(["B", "A"]));
  });

  test("collapses duplicates deterministically", () => {
    expect(visibleCoinsKey(["A", "A", "B"])).toBe(visibleCoinsKey(["A", "B"]));
    expect(visibleCoinsKey(["B", "A", "B"])).toBe(visibleCoinsKey(["B", "A"]));
  });

  test("the empty list maps to the empty key and stays stable", () => {
    expect(visibleCoinsKey([])).toBe("");
    expect(visibleCoinsKey([])).toBe(visibleCoinsKey([]));
  });
});

describe("createCtxBuffer", () => {
  const snapshot = (markPx: number): AssetCtxSnapshot => ({
    markPx,
    prevDayPx: 92620,
    funding: 0.00000625,
    dayNtlVlm: 563592476.12,
    openInterest: 2175,
    oraclePx: 93730,
  });

  test("three pushes over two coins flush as the last value per coin", () => {
    const commits: (readonly (readonly [string, AssetCtxSnapshot])[])[] = [];
    const buffer = createCtxBuffer((updates) => {
      commits.push(updates);
    });

    buffer.push("A", snapshot(1));
    buffer.push("B", snapshot(2));
    buffer.push("A", snapshot(3));
    buffer.flush();

    expect(commits).toHaveLength(1);
    expect(commits[0]).toEqual([
      ["A", snapshot(3)],
      ["B", snapshot(2)],
    ]);
  });

  test("flushing an empty buffer emits nothing", () => {
    let calls = 0;
    const buffer = createCtxBuffer(() => {
      calls++;
    });

    buffer.flush();

    expect(calls).toBe(0);
  });

  test("push, flush, push again starts a fresh batch", () => {
    const commits: (readonly (readonly [string, AssetCtxSnapshot])[])[] = [];
    const buffer = createCtxBuffer((updates) => {
      commits.push(updates);
    });

    buffer.push("A", snapshot(1));
    buffer.flush();
    buffer.push("B", snapshot(2));
    buffer.flush();

    expect(commits).toHaveLength(2);
    expect(commits[1]).toEqual([["B", snapshot(2)]]);
  });
});

describe("createVisibleCoinsSync", () => {
  test("delegates to setVisible with the caller's exact array reference", () => {
    const { stream, setVisible } = createFakeStream();
    const sync = createVisibleCoinsSync(stream);
    const coins = ["A", "B"];

    sync.apply(coins);

    expect(setVisible).toHaveBeenCalledTimes(1);
    expect(setVisible.mock.calls[0]?.[0]).toBe(coins);
  });

  test("calls setVisible once per distinct key, not per array identity", () => {
    const { stream, setVisible } = createFakeStream();
    const sync = createVisibleCoinsSync(stream);

    sync.apply(["A", "B"]);
    sync.apply(["A", "B"]);
    sync.apply(["A", "A", "B"]);

    expect(setVisible).toHaveBeenCalledTimes(1);

    sync.apply(["B", "A"]);
    sync.apply(["A", "B", "C"]);

    expect(setVisible).toHaveBeenCalledTimes(3);
  });

  test("dispose is idempotent and releases the stream exactly once", () => {
    const { stream, dispose } = createFakeStream();
    const sync = createVisibleCoinsSync(stream);

    sync.apply(["A"]);
    sync.dispose();
    sync.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test("apply after dispose never touches the stream again", () => {
    const { stream, setVisible, dispose } = createFakeStream();
    const sync = createVisibleCoinsSync(stream);

    sync.dispose();
    sync.apply(["A"]);

    expect(setVisible).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
