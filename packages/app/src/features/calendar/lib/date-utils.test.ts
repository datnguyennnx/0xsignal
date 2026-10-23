/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { EconomicEvent } from "@0xsignal/shared";

import { dayKey, toEventsByDay } from "./date-utils";

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
