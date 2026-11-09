/// <reference types="bun-types" />
import { describe, expect, mock, test } from "bun:test";
import type { IPriceLine, ISeriesApi, SeriesType } from "lightweight-charts";

import {
  createPriceLineState,
  removePriceLines,
  syncPriceLines,
  type ChartPriceLine,
} from "./price-lines";

type PriceLineSeries = Pick<ISeriesApi<SeriesType>, "createPriceLine" | "removePriceLine">;

interface FakeHandle {
  applyOptions: ReturnType<typeof mock>;
}

const COLORS: Record<string, string> = {
  "--gain": "#00ff00",
  "--loss": "#ff0000",
  "--muted-foreground": "#888888",
  "--accent-ink": "#0000ff",
};

const makeSeries = (): {
  series: PriceLineSeries;
  handles: FakeHandle[];
  createPriceLine: ReturnType<typeof mock>;
  removePriceLine: ReturnType<typeof mock>;
} => {
  const handles: FakeHandle[] = [];
  const createPriceLine = mock(() => {
    const handle: FakeHandle = { applyOptions: mock() };
    handles.push(handle);
    return handle as unknown as IPriceLine;
  });
  const removePriceLine = mock();
  return {
    series: { createPriceLine, removePriceLine } as unknown as PriceLineSeries,
    handles,
    createPriceLine,
    removePriceLine,
  };
};

const line = (price: number, overrides: Partial<ChartPriceLine> = {}): ChartPriceLine => ({
  price,
  tone: "gain",
  emphasis: "subject",
  ...overrides,
});

describe("createPriceLineState", () => {
  // No DOM harness in this package (no @testing-library/jsdom), so a hook-level
  // "initializer ran once" assertion is not available. The hook hands this exact
  // factory to `useState` as its lazy initializer and then mutates the arrays in
  // place, so the contract that matters here is: every call yields a fresh,
  // empty, standalone state.
  test("hands back a fresh empty state with independent arrays", () => {
    const first = createPriceLineState();
    const second = createPriceLineState();

    expect(first).not.toBe(second);
    expect(first.handles).toEqual([]);
    expect(first.styleKeys).toEqual([]);
    expect(first.handles).not.toBe(second.handles);
    expect(first.styleKeys).not.toBe(second.styleKeys);

    first.handles.push({} as IPriceLine);
    expect(first.handles).toHaveLength(1);
    expect(second.handles).toHaveLength(0);
  });
});

describe("syncPriceLines", () => {
  test("moves an unchanged line in place instead of recreating it", () => {
    const { series, handles, createPriceLine, removePriceLine } = makeSeries();
    const state = createPriceLineState();

    syncPriceLines(series, state, [line(100)], COLORS);
    expect(createPriceLine).toHaveBeenCalledTimes(1);
    expect(handles[0]?.applyOptions).toHaveBeenCalledTimes(0);

    syncPriceLines(series, state, [line(101)], COLORS);

    expect(createPriceLine).toHaveBeenCalledTimes(1);
    expect(removePriceLine).toHaveBeenCalledTimes(0);
    expect(handles[0]?.applyOptions).toHaveBeenCalledTimes(1);
    expect(handles[0]?.applyOptions.mock.calls[0]?.[0]).toMatchObject({ price: 101 });
  });

  test("removes and recreates only when the line set changes", () => {
    const { series, handles, createPriceLine, removePriceLine } = makeSeries();
    const state = createPriceLineState();

    syncPriceLines(series, state, [line(100), line(200)], COLORS);
    expect(createPriceLine).toHaveBeenCalledTimes(2);

    syncPriceLines(series, state, [line(100), line(300, { tone: "loss" })], COLORS);

    expect(removePriceLine).toHaveBeenCalledTimes(2);
    expect(createPriceLine).toHaveBeenCalledTimes(4);
    expect(handles[2]?.applyOptions).toHaveBeenCalledTimes(0);
  });

  test("cleanup removes every drawn line and clears the handles", () => {
    const { series, createPriceLine, removePriceLine } = makeSeries();
    const state = createPriceLineState();

    syncPriceLines(series, state, [line(100), line(200)], COLORS);
    expect(createPriceLine).toHaveBeenCalledTimes(2);

    removePriceLines(series, state);

    expect(removePriceLine).toHaveBeenCalledTimes(2);
    expect(state.handles).toHaveLength(0);
    expect(state.styleKeys).toHaveLength(0);
  });
});
