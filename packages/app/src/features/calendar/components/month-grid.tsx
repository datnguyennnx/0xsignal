import { isSameDay, isSameMonth } from "date-fns";
import { useState } from "react";
import type { JSX } from "react";
import type { EconomicEvent } from "@0xsignal/shared";

import { Surface } from "@/components/surface/surface";
import { MonthDayCell } from "./month-day-cell";
import { dayKey, WEEK_STARTS_ON, type EventsByDay } from "../lib/date-utils";

export interface MonthGridProps {
  days: Date[];
  monthDate: Date;
  selectedDate: Date | null;
  eventsByDay: EventsByDay;
  onSelectDate: (date: Date) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HEADER_LABELS = Array.from(
  { length: 7 },
  (_, index) => WEEKDAY_LABELS[(index + WEEK_STARTS_ON) % 7],
);

/** One empty bucket for every day without events, so the prop stays referentially stable. */
const NO_EVENTS: EconomicEvent[] = [];

export function MonthGrid({
  days,
  monthDate,
  selectedDate,
  eventsByDay,
  onSelectDate,
}: MonthGridProps): JSX.Element {
  // A snapshot, not a per-render read: a parent tick (refetch/pending) must not
  // hand every cell a fresh "today". It shares the grid's lifetime, like `anchor`.
  const [today] = useState(() => new Date());

  return (
    <Surface
      tier="content"
      className="flex w-full min-h-0 flex-1 flex-col gap-inline overflow-hidden p-2 md:p-panel"
    >
      <div className="grid grid-cols-7 gap-1">
        {HEADER_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-1 text-center type-label font-medium tracking-wider text-muted-foreground uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1">
        {days.map((date) => {
          const key = dayKey(date);
          return (
            <MonthDayCell
              key={key}
              date={date}
              events={eventsByDay.get(key) ?? NO_EVENTS}
              isCurrentMonth={isSameMonth(date, monthDate)}
              isToday={isSameDay(date, today)}
              isSelected={selectedDate !== null && isSameDay(date, selectedDate)}
              onSelect={onSelectDate}
            />
          );
        })}
      </div>
    </Surface>
  );
}
