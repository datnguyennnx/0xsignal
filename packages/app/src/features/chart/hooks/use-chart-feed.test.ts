/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { ChartDataPoint } from "@0xsignal/shared";

import {
  MAX_MARKER_FILLS,
  mapFillsToLogicalMarkers,
  markerFillWindow,
  selectMarkerFills,
  selectMarkerFillsInWindow,
  type HyperliquidFill,
} from "../../trade/utils/trade-markers";

const TIMEFRAME_SEC = 60;
const FIRST_CANDLE_SEC = 1_000_020;
const WINDOW_START_MS = FIRST_CANDLE_SEC * 1000;

const candles: ChartDataPoint[] = Array.from({ length: 10 }, (_, index) => ({
  time: FIRST_CANDLE_SEC + index * TIMEFRAME_SEC,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1,
}));

const fill = (tid: number, time: number): HyperliquidFill => ({
  coin: "BTC",
  px: "100",
  sz: "1",
  side: "B",
  time,
  dir: "Open Long",
  hash: `0x${tid.toString(16).padStart(64, "0")}`,
  tid,
});

describe("selectMarkerFills", () => {
  test("bounds 5000 in-window fills to the latest MAX_MARKER_FILLS before mapping", () => {
    const fills = Array.from({ length: 5000 }, (_, index) =>
      fill(index + 1, WINDOW_START_MS + 1_000 + index),
    );

    const selected = selectMarkerFills(fills, candles, TIMEFRAME_SEC);

    expect(selected.length).toBe(MAX_MARKER_FILLS);
    expect(selected[0]?.tid).toBe(5000);
    expect(selected.at(-1)?.tid).toBe(5000 - MAX_MARKER_FILLS + 1);

    const markers = mapFillsToLogicalMarkers(selected, TIMEFRAME_SEC, "BTC");
    expect(markers.length).toBeLessThanOrEqual(MAX_MARKER_FILLS);
  });

  test("excludes a fill older than the visible candle window", () => {
    const tooOld = fill(1, WINDOW_START_MS - 1);
    const inWindow = fill(2, WINDOW_START_MS + 500);

    const selected = selectMarkerFills([tooOld, inWindow], candles, TIMEFRAME_SEC);

    expect(selected.map((entry) => entry.tid)).toEqual([2]);
  });

  test("keeps an in-window fill and yields its marker", () => {
    const inWindow = fill(7, WINDOW_START_MS + 1_500);

    const markers = mapFillsToLogicalMarkers(
      selectMarkerFills([inWindow], candles, TIMEFRAME_SEC),
      TIMEFRAME_SEC,
      "BTC",
    );

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      id: "7",
      time: FIRST_CANDLE_SEC,
      price: 100,
      side: "buy",
    });
  });

  test("returns no fills when the chart has no candles", () => {
    expect(selectMarkerFills([fill(1, WINDOW_START_MS)], [], TIMEFRAME_SEC)).toEqual([]);
  });
});

describe("markerFillWindow", () => {
  test("a same-window candle tick keeps the selection input stable", () => {
    const before = markerFillWindow(candles, TIMEFRAME_SEC);
    const ticked = candles.map((candle) => ({
      ...candle,
      close: candle.close + 0.5,
      high: candle.high + 0.5,
    }));
    const after = markerFillWindow(ticked, TIMEFRAME_SEC);

    expect(after).toEqual(before);
    expect(after?.startMs).toBe(before?.startMs);
    expect(after?.endMs).toBe(before?.endMs);

    // The selection is a pure function of the window, so the same input yields
    // the same fills even when the candle ticks.
    const inWindow = fill(1, WINDOW_START_MS + 500);
    expect(selectMarkerFillsInWindow([inWindow], after)).toEqual(
      selectMarkerFillsInWindow([inWindow], before),
    );
  });

  test("moving the window changes the selection input", () => {
    const before = markerFillWindow(candles, TIMEFRAME_SEC);
    const extended: ChartDataPoint[] = [
      ...candles,
      {
        time: FIRST_CANDLE_SEC + candles.length * TIMEFRAME_SEC,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1,
      },
    ];
    const after = markerFillWindow(extended, TIMEFRAME_SEC);

    expect(after).not.toEqual(before);
    expect(after?.endMs).toBe((FIRST_CANDLE_SEC + (candles.length + 1) * TIMEFRAME_SEC) * 1000);
  });
});
