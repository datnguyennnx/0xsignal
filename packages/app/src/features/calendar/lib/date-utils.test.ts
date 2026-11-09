/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { EconomicEvent } from "@0xsignal/shared";

import { endOfDay, startOfDay } from "date-fns";

import {
  dayKey,
  getMonthCalendarQuery,
  getMonthGridDays,
  getViewRange,
  selectDayEventsFromMonth,
  toEventsByDay,
} from "./date-utils";

const BASE_EVENT: EconomicEvent = {
  id: "",
  source: "bls",
  sourceEventId: "",
  title: "",
  country: "US",
  currency: "USD",
  category: "macro",
  impact: "medium",
  scheduledAt: "",
  allDay: false,
  period: null,
  forecast: null,
  previous: null,
  actual: null,
  revised: null,
  sourceUrl: null,
  attribution: "test",
  fetchedAt: new Date(2026, 0, 1).toISOString(),
};

function makeEvent(id: string, scheduledAt: string): EconomicEvent {
  return { ...BASE_EVENT, id, sourceEventId: id, title: id, scheduledAt };
}

const at = (day: number, hour: number, minute = 0): string =>
  new Date(2026, 0, day, hour, minute).toISOString();

const gridBounds = (days: Date[]): { first: string; last: string } => {
  const first = days.at(0);
  const last = days.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error("expected a non-empty month grid");
  }
  return { first: dayKey(first), last: dayKey(last) };
};

// Deliberately out of order, interleaving two local days and two times per day.
const OUT_OF_ORDER: EconomicEvent[] = [
  makeEvent("a-late", at(13, 14)),
  makeEvent("b-late", at(14, 16)),
  makeEvent("a-early", at(13, 9)),
  makeEvent("b-early", at(14, 8)),
];

describe("toEventsByDay", () => {
  test("buckets events by local day", () => {
    const byDay = toEventsByDay(OUT_OF_ORDER);

    expect([...byDay.keys()]).toEqual([dayKey(new Date(at(13, 0))), dayKey(new Date(at(14, 0)))]);
    expect(byDay.get(dayKey(new Date(at(13, 0))))).toHaveLength(2);
    expect(byDay.get(dayKey(new Date(at(14, 0))))).toHaveLength(2);
  });

  test("sorts each bucket ascending by scheduledAt", () => {
    const byDay = toEventsByDay(OUT_OF_ORDER);

    expect(byDay.get(dayKey(new Date(at(13, 0))))?.map((event) => event.id)).toEqual([
      "a-early",
      "a-late",
    ]);
    expect(byDay.get(dayKey(new Date(at(14, 0))))?.map((event) => event.id)).toEqual([
      "b-early",
      "b-late",
    ]);
  });
});

describe("getMonthCalendarQuery", () => {
  test("covers the full month grid from local start of day to local end of day", () => {
    const anchor = new Date(2026, 10, 15);
    const query = getMonthCalendarQuery(anchor);
    const days = getMonthGridDays(anchor);

    expect(query.from).toBe(startOfDay(days[0] as Date).toISOString());
    expect(query.to).toBe(endOfDay(days.at(-1) as Date).toISOString());
  });
});

describe("selectDayEventsFromMonth", () => {
  const monthEvents = [makeEvent("a", at(13, 9)), makeEvent("b", at(14, 16))];

  test("returns null when the month is not cached", () => {
    expect(selectDayEventsFromMonth(undefined, dayKey(new Date(at(13, 0))))).toBeNull();
  });

  test("derives only the requested day from a cached month", () => {
    const events = selectDayEventsFromMonth({ events: monthEvents }, dayKey(new Date(at(13, 0))));

    expect(events?.map((event) => event.id)).toEqual(["a"]);
  });

  test("distinguishes a cached empty day from an uncached month", () => {
    const events = selectDayEventsFromMonth({ events: monthEvents }, dayKey(new Date(at(20, 0))));

    expect(events).toEqual([]);
  });
});

describe("getMonthGridDays", () => {
  test("ends on the week containing month end", () => {
    const days = getMonthGridDays(new Date(2026, 10, 1));

    expect(days).toHaveLength(35);
    expect(gridBounds(days)).toEqual({ first: "2026-11-01", last: "2026-12-05" });
  });

  test("returns a single four-week row when the month fits", () => {
    const days = getMonthGridDays(new Date(2026, 1, 1));

    expect(days).toHaveLength(28);
    expect(gridBounds(days)).toEqual({ first: "2026-02-01", last: "2026-02-28" });
  });

  test("drives the view range", () => {
    const anchor = new Date(2026, 10, 1);

    const days = getMonthGridDays(anchor);
    const { from, to } = getViewRange(anchor);

    expect({ first: dayKey(from), last: dayKey(to) }).toEqual(gridBounds(days));
  });
});
