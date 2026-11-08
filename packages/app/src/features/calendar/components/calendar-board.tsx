import { useMemo, useState, useTransition } from "react";
import type { JSX } from "react";
import type { CalendarQuery } from "@0xsignal/shared";

import { useCalendarDayPanel } from "@/components/app-side-panel";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useCalendarEvents } from "../hooks/use-calendar-data";
import {
  formatMonthTitle,
  formatRangeLabel,
  getMonthGridDays,
  getViewRange,
  shiftAnchor,
  toEventsByDay,
} from "../lib/date-utils";
import { CalendarHeader, type CalendarCategoryFilterValue } from "./calendar-header";
import { MonthGrid } from "./month-grid";

const CATEGORY_LABEL: Record<CalendarCategoryFilterValue, string> = {
  all: "All",
  macro: "Macro",
  fx: "FX",
  crypto: "Crypto",
};

interface CalendarEmptyStateProps {
  category: CalendarCategoryFilterValue;
  monthTitle: string;
  onShowAll: () => void;
  fill?: boolean;
}

function CalendarEmptyState({
  category,
  monthTitle,
  onShowAll,
  fill = false,
}: CalendarEmptyStateProps): JSX.Element {
  if (category === "all") {
    return (
      <EmptyState
        variant="chart"
        fill={fill}
        title={`No events in ${monthTitle}`}
        description="Nothing is scheduled for this month."
      />
    );
  }

  const label = CATEGORY_LABEL[category];

  return (
    <EmptyState
      variant="chart"
      fill={fill}
      title={`No ${label} events this month`}
      description={`The ${label} filter is hiding other events. Clear it to see everything scheduled in ${monthTitle}.`}
      action={
        <Button variant="outline" onClick={onShowAll}>
          Show all
        </Button>
      }
    />
  );
}

export function CalendarBoard(): JSX.Element {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [category, setCategory] = useState<CalendarCategoryFilterValue>("all");
  const [isPending, startTransition] = useTransition();
  const { selectedDate, selectDay } = useCalendarDayPanel();

  const range = useMemo(() => getViewRange(anchor), [anchor]);

  const query = useMemo<CalendarQuery>(() => {
    const from = new Date(range.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(range.to);
    to.setHours(23, 59, 59, 999);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      category: category === "all" ? undefined : [category],
    };
  }, [range, category]);

  const { data, isLoading, isError, isFetching, refetch } = useCalendarEvents(query);

  const eventsByDay = useMemo(() => toEventsByDay(data?.events ?? []), [data]);

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

      {isLoading ? (
        <Skeleton className="min-h-0 w-full flex-1" />
      ) : isError ? (
        <ErrorState
          title="Unable to load events"
          retryAction={handleRefresh}
          className="flex min-h-0 flex-1 items-center justify-center"
        />
      ) : eventsByDay.size === 0 ? (
        <CalendarEmptyState
          category={category}
          monthTitle={monthTitle}
          fill
          onShowAll={() => {
            changeCategory("all");
          }}
        />
      ) : (
        <MonthGrid
          days={gridDays}
          monthDate={anchor}
          selectedDate={selectedDate}
          eventsByDay={eventsByDay}
          onSelectDate={selectDay}
        />
      )}
    </div>
  );
}
