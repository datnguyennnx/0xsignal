/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";
import { createElement } from "react";

import type { EconomicEvent } from "@0xsignal/shared";

import { cleanup, hasDom, renderDom } from "../../../../test/render";

import { MonthDayCell } from "./month-day-cell";

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

function renderCell(events: EconomicEvent[], onSelect = noop) {
  return renderDom(
    createElement(MonthDayCell, {
      date: new Date(2026, 10, 9),
      events,
      isCurrentMonth: true,
      isToday: false,
      isSelected: false,
      onSelect,
    }),
  );
}

afterEach(cleanup);

describe.skipIf(!hasDom)("a month day cell", () => {
  test("keeps three chip slots and labels the rest as overflow", () => {
    let selected = 0;
    const view = renderCell(["a", "b", "c", "d", "e"].map(event), () => {
      selected += 1;
    });

    const chips = [...view.container.querySelectorAll("[title]")].map((chip) =>
      chip.getAttribute("title"),
    );
    expect(chips).toEqual(["a", "b", "c"]);

    const overflow = view.getByRole("button", { name: /show 2 more events/i });
    expect(overflow.textContent).toBe("+2 more");

    overflow.click();
    expect(selected).toBe(1);
  });

  test("renders no overflow control when every event fits", () => {
    const view = renderCell([event("a")]);

    expect(view.container.querySelectorAll("[title]")).toHaveLength(1);
    expect(view.container.textContent).not.toContain("more");
  });
});
