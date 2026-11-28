import { memo } from "react";
import type { JSX } from "react";
import type { EconomicEvent } from "@0xsignal/shared";

import { format } from "date-fns";

import { formatDateLabel } from "../lib/date-utils";
import { EventChip } from "./event-chip";
import { areMonthDayCellPropsEqual, type MonthDayCellProps } from "./month-day-cell-logic";

/** Fixed slots: the cell's grid rows define capacity, so no height measurement is needed. */
const VISIBLE_CHIP_SLOTS = 3;

const CELL_CLASS =
  "relative flex h-full min-h-0 min-w-0 flex-col gap-1 rounded-panel border bg-(--surface-raised) p-3 text-left motion-control hover:bg-(--control-hover-bg) data-[state=selected]:border-(--control-active-rim) data-[state=out-of-month]:text-muted-foreground";

const HEADER_CLASS = "pointer-events-none relative z-10 flex min-w-0 items-center gap-2";

const WEEKDAY_CLASS = "type-label font-medium tracking-wider text-muted-foreground uppercase";

const DATE_CLASS = "type-data font-semibold tabular-nums";

const COUNT_CLASS = "ml-auto type-label tabular-nums text-muted-foreground";

const EVENT_LIST_CLASS =
  "pointer-events-none relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden";

const OVERFLOW_CLASS =
  "pointer-events-auto relative z-10 h-8 w-full shrink-0 rounded-control px-2 text-left type-label font-medium text-muted-foreground motion-control hover:bg-(--control-hover-bg) hover:text-foreground focus-ring-inset";

type DayState = "selected" | "today" | "default" | "out-of-month";

function getDayState(isSelected: boolean, isToday: boolean, isCurrentMonth: boolean): DayState {
  if (isSelected) return "selected";
  if (isToday) return "today";
  return isCurrentMonth ? "default" : "out-of-month";
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
      <div className={EVENT_LIST_CLASS}>
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
  const dataState = getDayState(isSelected, isToday, isCurrentMonth);

  return (
    <div data-state={dataState} className={CELL_CLASS}>
      <button
        type="button"
        aria-pressed={isSelected}
        aria-current={isToday ? "date" : undefined}
        aria-label={`Select ${formatDateLabel(date)}, ${eventLabel}`}
        onClick={() => {
          onSelect(date);
        }}
        className="absolute inset-0 z-0 cursor-pointer rounded-panel focus-ring-inset"
      />

      <div className={HEADER_CLASS}>
        {isToday && (
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
        )}
        <span className={WEEKDAY_CLASS}>{format(date, "EEE")}</span>
        <span className={DATE_CLASS}>{date.getDate()}</span>
        <span className={COUNT_CLASS}>{eventLabel}</span>
      </div>

      <DayEventList events={events} date={date} onSelect={onSelect} />
    </div>
  );
}, areMonthDayCellPropsEqual);
