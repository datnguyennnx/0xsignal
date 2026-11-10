/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import type { EconomicEvent } from "@0xsignal/shared";

import { areMonthDayCellPropsEqual } from "./month-day-cell-logic";

const CELL_SOURCE = readFileSync(new URL("./month-day-cell.tsx", import.meta.url), "utf8");

const noop = (): void => {};

const event = (id: string): EconomicEvent => ({
  id,
  source: "bls",
  sourceEventId: id,
  title: id,
  country: "US",
  currency: "USD",
  category: "macro",
  impact: "medium",
  scheduledAt: new Date(2026, 10, 9, 12).toISOString(),
  allDay: false,
  period: null,
  forecast: null,
  previous: null,
  actual: null,
  revised: null,
  sourceUrl: null,
  attribution: "test",
  fetchedAt: new Date(2026, 0, 1).toISOString(),
});

type CellProps = Parameters<typeof areMonthDayCellPropsEqual>[0];

const EVENTS = [event("a")];

const cellProps = (overrides: Partial<CellProps> = {}): CellProps => ({
  date: new Date(2026, 10, 9),
  events: EVENTS,
  isCurrentMonth: true,
  isToday: false,
  isSelected: false,
  onSelect: noop,
  ...overrides,
});

describe("the clipped event list keeps focus outlines whole", () => {
  test("it carries vertical slack with a matching negative margin", () => {
    expect(CELL_SOURCE).toContain("overflow-hidden py-0.5 -my-0.5");
  });
});

describe("areMonthDayCellPropsEqual", () => {
  test("skips a cell when every rendered value is unchanged", () => {
    const prev = cellProps();
    const next = cellProps({ date: new Date(2026, 10, 9) });

    expect(prev.date).not.toBe(next.date);
    expect(areMonthDayCellPropsEqual(prev, next)).toBe(true);
  });

  test("re-renders when the day changes", () => {
    const prev = cellProps();

    expect(areMonthDayCellPropsEqual(prev, cellProps({ date: new Date(2026, 10, 10) }))).toBe(
      false,
    );
  });

  test("re-renders when the event bucket changes identity", () => {
    const prev = cellProps();

    expect(areMonthDayCellPropsEqual(prev, cellProps({ events: [event("a")] }))).toBe(false);
  });

  test("re-renders when a painted flag changes", () => {
    const prev = cellProps();

    expect(areMonthDayCellPropsEqual(prev, cellProps({ isCurrentMonth: false }))).toBe(false);
    expect(areMonthDayCellPropsEqual(prev, cellProps({ isToday: true }))).toBe(false);
    expect(areMonthDayCellPropsEqual(prev, cellProps({ isSelected: true }))).toBe(false);
  });

  test("re-renders when the select callback changes identity", () => {
    const prev = cellProps();

    expect(areMonthDayCellPropsEqual(prev, cellProps({ onSelect: () => {} }))).toBe(false);
  });
});
