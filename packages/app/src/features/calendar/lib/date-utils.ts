import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { EconomicEvent } from "@0xsignal/shared";

import type { EventsByDay } from "../types";

export const WEEK_STARTS_ON = 0;

const WEEK_OPTIONS = { weekStartsOn: WEEK_STARTS_ON } as const;

export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function getMonthGridDays(anchor: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(anchor), WEEK_OPTIONS);
  return eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 41) });
}

export function getViewRange(anchor: Date): { from: Date; to: Date } {
  const days = getMonthGridDays(anchor);
  return { from: days[0], to: days[days.length - 1] };
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
