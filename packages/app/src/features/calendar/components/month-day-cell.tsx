import { memo, useLayoutEffect, useRef, useState } from "react";
import type { JSX, RefObject } from "react";
import type { EconomicEvent } from "@0xsignal/shared";

import { cn } from "cn";

import { observeResize } from "@/lib/resize-observer";

import { EventChip } from "./event-chip";
import { areMonthDayCellPropsEqual, type MonthDayCellProps } from "./month-day-cell-logic";

const INITIAL_CHIP_GUESS = 3;

const CELL_CLASS =
  "relative flex h-full min-h-0 flex-col gap-1 rounded-(--calendar-cell-radius) bg-(--control-bg) p-1 text-left motion-control hover:bg-(--control-hover-bg) data-[state=selected]:bg-(--control-active-bg) data-[state=selected]:text-foreground data-[state=selected]:shadow-[inset_0_1px_0_var(--control-active-rim)] data-[state=selected]:hover:bg-(--control-active-bg) data-[state=out-of-month]:bg-transparent data-[state=out-of-month]:text-muted-foreground data-[state=out-of-month]:hover:bg-transparent data-[state=today]:ring-1 data-[state=today]:ring-ring data-[state=today]:ring-inset md:p-2";

const OVERFLOW_CLASS =
  "pointer-events-auto relative z-10 w-full shrink-0 rounded-chip px-1 text-left type-label font-medium text-muted-foreground tabular-nums hover:text-foreground focus-ring-inset";

const DATE_CLASS =
  "pointer-events-none relative z-10 flex size-(--control-h-chip) items-center justify-center self-end rounded-full type-label font-medium tabular-nums md:size-(--calendar-date-size)";

function useVisibleChipCount(listRef: RefObject<HTMLDivElement | null>, total: number): number {
  const chipHeight = useRef(0);
  const [count, setCount] = useState(() => Math.min(total, INITIAL_CHIP_GUESS));

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) return () => {};

    const measure = () => {
      const chip = list.firstElementChild;
      if (chip instanceof HTMLElement && chip.offsetHeight > 0) {
        chipHeight.current = chip.offsetHeight;
      }
      const height = chipHeight.current;
      if (height === 0) return;

      const gap = Number(getComputedStyle(list).rowGap) || 0;
      const capacity = Math.floor((list.clientHeight + gap) / (height + gap));
      setCount(Math.max(0, Math.min(total, capacity)));
    };

    measure();
    return observeResize(list, measure);
  }, [listRef, total]);

  return Math.min(count, total);
}

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
  const listRef = useRef<HTMLDivElement>(null);
  const visibleCount = useVisibleChipCount(listRef, events.length);
  const visible = events.slice(0, visibleCount);
  const overflow = events.length - visible.length;

  return (
    <>
      <div
        ref={listRef}
        className="pointer-events-none relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden"
      >
        {visible.map((event) => (
          <EventChip key={event.id} event={event} className="shrink-0" />
        ))}
      </div>

      {overflow > 0 && (
        <button
          type="button"
          aria-label={`Show ${overflow} more events on ${date.toLocaleDateString()}`}
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
    <div data-state={dataState} className={CELL_CLASS}>
      <button
        type="button"
        aria-pressed={isSelected}
        aria-current={isToday ? "date" : undefined}
        aria-label={`Select ${date.toLocaleDateString()}, ${eventLabel}`}
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
