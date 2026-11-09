/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CALENDAR_SKELETON_COLUMNS, CalendarMonthGridSkeleton } from "./calendar-board";

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe("calendar month-grid skeleton", () => {
  test("uses seven columns like the real grid", () => {
    expect(CALENDAR_SKELETON_COLUMNS).toBe(7);
  });

  test("reserves the weekday header and one cell per grid day", () => {
    const days = Array.from({ length: 35 }, (_, index) => new Date(2026, 0, index + 1));
    const html = renderToStaticMarkup(<CalendarMonthGridSkeleton days={days} />);

    expect(count(html, "data-calendar-skeleton-head")).toBe(7);
    expect(count(html, "data-calendar-skeleton-cell")).toBe(35);
    expect(count(html, "grid-cols-7")).toBe(2);
  });

  test("announces loading instead of exposing decorative skeletons", () => {
    const html = renderToStaticMarkup(
      <CalendarMonthGridSkeleton
        days={Array.from({ length: 7 }, (_, i) => new Date(2026, 0, i + 1))}
      />,
    );

    expect(html).toContain("<output");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-hidden="true"');
  });
});
