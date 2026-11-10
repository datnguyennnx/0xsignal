/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (name: string): string => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

const chartHeader = read("chart-header.tsx");
const paramField = read("param-field.tsx");
const indicatorChips = read("indicator-chips.tsx");
const chartOhlcOverlay = read("chart-ohlc-overlay.tsx");

describe("scroll containers keep focus rings inside the clip", () => {
  test("chart-header row carries a vertical slack and matching negative margin", () => {
    expect(chartHeader).toContain("overflow-x-auto scrollbar-hide py-0.5 -my-0.5");
  });

  test("indicator chips strip carries the same slack", () => {
    expect(indicatorChips).toContain("overflow-x-auto scrollbar-hide");
    expect(indicatorChips).toContain("py-0.5 -my-0.5");
  });

  test("ohlc overlay grows its vertical padding by the slack and offsets it", () => {
    expect(chartOhlcOverlay).toContain("overflow-x-auto scrollbar-hide w-fit");
    expect(chartOhlcOverlay).toContain("py-[calc(0.35rem_+_0.175rem)] -my-0.5");
  });
});

describe("param-field no longer clips focus", () => {
  test("the segmented wrapper drops overflow-hidden", () => {
    expect(paramField).not.toContain("overflow-hidden");
  });

  test("it still keeps the rounded control surface and focus ring", () => {
    expect(paramField).toContain(
      "flex items-center bg-muted/40 rounded-control focus-ring-within w-full",
    );
  });
});

describe("button heights are untouched", () => {
  test("chart-header still delegates action height to the row-actions rule", () => {
    expect(chartHeader).not.toContain("h-[");
    expect(chartHeader).toContain("row-actions justify-between");
  });

  test("param-field buttons keep their explicit minimum heights", () => {
    expect(paramField).toContain("min-h-[40px] min-w-[40px]");
  });
});
