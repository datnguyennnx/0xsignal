import { useMemo, useState, useTransition } from "react";
import type { JSX, ReactNode } from "react";

import { useCalendarDayPanel } from "@/components/app-side-panel";
import { Region } from "@/components/region";
import { Surface } from "@/components/surface/surface";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useCalendarEvents } from "../hooks/use-calendar-data";
import {
  dayKey,
  formatMonthTitle,
  formatRangeLabel,
  getMonthCalendarQuery,
  getMonthGridDays,
  shiftAnchor,
  toEventsByDay,
} from "../lib/date-utils";
import { CalendarHeader, type CalendarCategoryFilterValue } from "./calendar-header";
import { categoryLabel } from "./calendar-filters-model";
import { MonthGrid, MONTH_GRID_SURFACE_CLASS } from "./month-grid";

interface CalendarEmptyCopy {
  title: string;
  description: string;
  action?: ReactNode;
}

function emptyCopyFor(
  category: CalendarCategoryFilterValue,
  monthTitle: string,
  onShowAll: () => void,
): CalendarEmptyCopy {
  if (category === "all") {
    return {
      title: `No events in ${monthTitle}`,
      description: "Nothing is scheduled for this month.",
    };
  }

  const label = categoryLabel(category);
  return {
    title: `No ${label} events this month`,
    description: `The ${label} filter is hiding other events. Clear it to see everything scheduled in ${monthTitle}.`,
    action: (
      <Button variant="outline" onClick={onShowAll}>
        Show all
      </Button>
    ),
  };
}

const CALENDAR_SKELETON_COLUMNS = 7;

/** Reserves the real month grid's shape: weekday header plus one cell per grid day. */
export function CalendarMonthGridSkeleton({ days }: { days: readonly Date[] }): JSX.Element {
  return (
    <Surface
      as="output"
      tier="content"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading calendar events"
      className={MONTH_GRID_SURFACE_CLASS}
    >
      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {Array.from({ length: CALENDAR_SKELETON_COLUMNS }, (_, index) => (
          <Skeleton key={index} data-calendar-skeleton-head className="mx-1 h-4 rounded-control" />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1" aria-hidden="true">
        {days.map((date) => (
          <Skeleton
            key={dayKey(date)}
            data-calendar-skeleton-cell
            className="h-full min-h-0 rounded-control"
          />
        ))}
      </div>
    </Surface>
  );
}

export function CalendarBoard(): JSX.Element {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [category, setCategory] = useState<CalendarCategoryFilterValue>("all");
  const [isPending, startTransition] = useTransition();
  const { selectedDate, selectDay } = useCalendarDayPanel();

  // The query object is cheap and its derived key is stable; memoizing the
  // wrapper bought nothing but a dependency check.
  const query = {
    ...getMonthCalendarQuery(anchor),
    category: category === "all" ? undefined : [category],
  };

  const { state, isFetching, refetch } = useCalendarEvents(query, {
    keepPreviousData: true,
  });

  const gridDays = useMemo(() => getMonthGridDays(anchor), [anchor]);

  const monthTitle = formatMonthTitle(anchor);

  const changeMonth = (next: (current: Date) => Date) => {
    startTransition(() => {
      setAnchor(next);
    });
  };

  const changeCategory = (next: CalendarCategoryFilterValue) => {
    startTransition(() => {
      setCategory(next);
    });
  };

  const handleToday = () => {
    changeMonth(() => new Date());
  };

  const handleRefresh = () => {
    void refetch();
  };

  return (
    <div className="flex w-full flex-1 min-h-0 flex-col gap-panel">
      <CalendarHeader
        title={monthTitle}
        rangeLabel={formatRangeLabel(anchor)}
        category={category}
        onCategoryChange={changeCategory}
        onPrev={() => {
          changeMonth((current) => shiftAnchor(current, -1));
        }}
        onNext={() => {
          changeMonth((current) => shiftAnchor(current, 1));
        }}
        onToday={handleToday}
        onRefresh={handleRefresh}
        isRefreshing={isFetching || isPending}
      />

      <Region
        state={state}
        label="Calendar events"
        className="flex min-h-0 flex-1 flex-col"
        skeleton={<CalendarMonthGridSkeleton days={gridDays} />}
        empty={emptyCopyFor(category, monthTitle, () => {
          changeCategory("all");
        })}
        error={{ title: "Unable to load events", retry: handleRefresh }}
      >
        {(data) => (
          <MonthGrid
            days={gridDays}
            monthDate={anchor}
            selectedDate={selectedDate}
            eventsByDay={toEventsByDay(data.events)}
            onSelectDate={selectDay}
          />
        )}
      </Region>
    </div>
  );
}
