import { isSameDay, isSameMonth } from "date-fns";
import type { JSX } from "react";

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

export function MonthGrid({
  days,
  monthDate,
  selectedDate,
  eventsByDay,
  onSelectDate,
}: MonthGridProps): JSX.Element {
  const today = new Date();

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
        {days.map((date) => (
          <MonthDayCell
            key={dayKey(date)}
            date={date}
            events={eventsByDay.get(dayKey(date)) ?? []}
            isCurrentMonth={isSameMonth(date, monthDate)}
            isToday={isSameDay(date, today)}
            isSelected={selectedDate !== null && isSameDay(date, selectedDate)}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </Surface>
  );
}
