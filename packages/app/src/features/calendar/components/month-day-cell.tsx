import { memo } from "react";
import type { JSX } from "react";
import type { EconomicEvent } from "@0xsignal/shared";

import { cn } from "cn";

import { formatDateLabel } from "../lib/date-utils";
import { EventChip } from "./event-chip";
import { areMonthDayCellPropsEqual, type MonthDayCellProps } from "./month-day-cell-logic";

/** Fixed slots: the cell's grid rows define capacity, so no height measurement is needed. */
const VISIBLE_CHIP_SLOTS = 3;

const CELL_CLASS =
  "relative flex h-full min-h-0 flex-col gap-1 rounded-(--calendar-cell-radius) bg-(--control-bg) p-1 text-left motion-control hover:bg-(--control-hover-bg) data-[state=selected]:bg-(--control-active-bg) data-[state=selected]:text-foreground data-[state=selected]:shadow-[inset_0_1px_0_var(--control-active-rim)] data-[state=selected]:hover:bg-(--control-active-bg) data-[state=out-of-month]:bg-transparent data-[state=out-of-month]:text-muted-foreground data-[state=out-of-month]:hover:bg-transparent md:p-2";

const OVERFLOW_CLASS =
  "pointer-events-auto relative z-10 w-full shrink-0 rounded-chip px-1 text-left type-label font-medium text-muted-foreground tabular-nums hover:text-foreground focus-ring-inset";

const DATE_CLASS =
  "pointer-events-none relative z-10 flex size-(--control-h-chip) items-center justify-center self-end rounded-full type-label font-medium tabular-nums md:size-(--calendar-date-size)";

type DayState = "selected" | "today" | "default" | "out-of-month";

interface DayStateResult {
  dataState: DayState;
  dateStateClass: string;
}

function getDayState(
  isSelected: boolean,
  isToday: boolean,
  isCurrentMonth: boolean,
): DayStateResult {
  if (isSelected) {
    return { dataState: "selected", dateStateClass: "bg-info text-primary-foreground" };
  }

  const dataState: DayState = isToday ? "today" : isCurrentMonth ? "default" : "out-of-month";
  const dateStateClass =
    isToday && isCurrentMonth
      ? "text-primary"
      : isCurrentMonth
        ? "text-foreground"
        : "text-muted-foreground";

  return { dataState, dateStateClass };
}

interface DayEventListProps {
  events: EconomicEvent[];
  date: Date;
  onSelect: (date: Date) => void;
}

function DayEventList({ events, date, onSelect }: DayEventListProps): JSX.Element {
  const visible = events.slice(0, VISIBLE_CHIP_SLOTS);
  const overflow = events.length - visible.length;

  return (
    <>
      <div className="pointer-events-none relative z-10 grid min-h-0 min-w-0 flex-1 grid-rows-3 content-start gap-1 overflow-hidden">
        {visible.map((event) => (
          <EventChip key={event.id} event={event} />
        ))}
      </div>

      {overflow > 0 && (
        <button
          type="button"
          aria-label={`Show ${overflow} more events on ${formatDateLabel(date)}`}
          onClick={() => {
            onSelect(date);
          }}
          className={OVERFLOW_CLASS}
        >
          +{overflow} more
        </button>
      )}
    </>
  );
}

export const MonthDayCell = memo(function MonthDayCell({
  date,
  events,
  isCurrentMonth,
  isToday,
  isSelected,
  onSelect,
}: MonthDayCellProps): JSX.Element {
  const eventLabel = events.length === 1 ? "1 event" : `${events.length} events`;
  const { dataState, dateStateClass } = getDayState(isSelected, isToday, isCurrentMonth);

  return (
    <div data-state={dataState} className={cn(CELL_CLASS, dataState === "today" && "today-ring")}>
      <button
        type="button"
        aria-pressed={isSelected}
        aria-current={isToday ? "date" : undefined}
        aria-label={`Select ${formatDateLabel(date)}, ${eventLabel}`}
        onClick={() => {
          onSelect(date);
        }}
        className="absolute inset-0 z-0 cursor-pointer rounded-(--calendar-cell-radius) focus-ring-inset"
      />

      <span className={cn(DATE_CLASS, dateStateClass)}>{date.getDate()}</span>

      <DayEventList events={events} date={date} onSelect={onSelect} />
    </div>
  );
}, areMonthDayCellPropsEqual);
