/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { keepPreviousData } from "@tanstack/react-query";
import type { CalendarQuery } from "@0xsignal/shared";

import { calendarEventsQueryOptions } from "./use-calendar-data";

const QUERY: CalendarQuery = {
  from: "2026-11-01T00:00:00.000Z",
  to: "2026-12-05T23:59:59.999Z",
};

describe("calendarEventsQueryOptions", () => {
  test("keeps the previous month visible only when asked", () => {
    const month = calendarEventsQueryOptions(QUERY, { keepPreviousData: true });
    const plain = calendarEventsQueryOptions(QUERY);

    expect(month.placeholderData).toBe(keepPreviousData);
    expect(plain).not.toHaveProperty("placeholderData");
  });

  test("only carries an enabled flag when the caller provides one", () => {
    expect(calendarEventsQueryOptions(QUERY, { enabled: false }).enabled).toBe(false);
    expect(calendarEventsQueryOptions(QUERY)).not.toHaveProperty("enabled");
  });
});
