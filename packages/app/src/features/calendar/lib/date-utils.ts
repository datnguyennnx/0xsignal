import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { CalendarQuery, EconomicEvent } from "@0xsignal/shared";

import { dayKey } from "@/lib/day-key";

export type EventsByDay = Map<string, EconomicEvent[]>;

export const WEEK_STARTS_ON = 0;

const WEEK_OPTIONS = { weekStartsOn: WEEK_STARTS_ON } as const;

export { dayKey };

export function getMonthGridDays(anchor: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(anchor), WEEK_OPTIONS);
  const gridEnd = endOfWeek(endOfMonth(anchor), WEEK_OPTIONS);
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function getViewRange(anchor: Date): { from: Date; to: Date } {
  const days = getMonthGridDays(anchor);
  const from = days[0];
  return { from, to: days.at(-1) ?? from };
}

/**
 * The month query both the board and the day panel use. The board adds its
 * category filter on top; the day panel needs the unfiltered cache entry so
 * it can derive a day without issuing a second overlapping request.
 */
export function getMonthCalendarQuery(anchor: Date): CalendarQuery {
  const { from, to } = getViewRange(anchor);
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

/**
 * Derive one day from a cached month response. `null` means the month is not
 * cached (or still loading); an empty array means it is cached and has no
 * events that day. The distinction lets the caller decide whether it still
 * needs its own fetch.
 */
export function selectDayEventsFromMonth(
  data: { readonly events: readonly EconomicEvent[] } | undefined,
  id: string,
): EconomicEvent[] | null {
  if (data === undefined) return null;
  return data.events.filter((event) => dayKey(new Date(event.scheduledAt)) === id);
}

export function shiftAnchor(anchor: Date, direction: -1 | 1): Date {
  return addMonths(anchor, direction);
}

export function formatRangeLabel(anchor: Date): string {
  return `${format(startOfMonth(anchor), "MMM d, yyyy")} – ${format(endOfMonth(anchor), "MMM d, yyyy")}`;
}

export function formatMonthTitle(anchor: Date): string {
  return format(anchor, "MMMM yyyy");
}

export function toEventsByDay(events: EconomicEvent[]): EventsByDay {
  const byDay: EventsByDay = new Map();
  for (const event of events) {
    const key = dayKey(new Date(event.scheduledAt));
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      byDay.set(key, [event]);
    }
  }
  for (const bucket of byDay.values()) {
    bucket.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }
  return byDay;
}
