import { isSameDay, isSameMonth } from "date-fns";
import type { JSX } from "react";
import type { EconomicEvent } from "@0xsignal/shared";

import { Surface } from "@/components/surface/surface";
import { MonthDayCell } from "./month-day-cell";
import { dayKey, WEEK_STARTS_ON, type EventsByDay } from "../lib/date-utils";

export interface MonthGridProps {
  days: Date[];
  monthDate: Date;
  selectedDate: Date;
  eventsByDay: EventsByDay;
  onSelectDate: (date: Date) => void;
  onEventClick?: (event: EconomicEvent) => void;
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
  onEventClick,
}: MonthGridProps): JSX.Element {
  const today = new Date();

  return (
    <Surface tier="content" className="flex w-full flex-col gap-1 overflow-hidden">
      <div className="grid grid-cols-7 gap-1">
        {HEADER_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[length:var(--text-micro)] font-medium tracking-wider text-muted-foreground uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => (
          <MonthDayCell
            key={dayKey(date)}
            date={date}
            events={eventsByDay.get(dayKey(date)) ?? []}
            isCurrentMonth={isSameMonth(date, monthDate)}
            isToday={isSameDay(date, today)}
            isSelected={isSameDay(date, selectedDate)}
            onSelect={onSelectDate}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </Surface>
  );
}
