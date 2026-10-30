import { useMemo, useState } from "react";
import type { JSX } from "react";
import type { CalendarQuery } from "@0xsignal/shared";

import { useCalendarDayPanel } from "@/components/app-side-panel";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

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

interface CalendarBoardProps {
  className?: string;
}

export function CalendarBoard({ className }: CalendarBoardProps): JSX.Element {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [category, setCategory] = useState<CalendarCategoryFilterValue>("all");
  const { selectedDate, selectDay, openDay } = useCalendarDayPanel();

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

  const handleToday = () => {
    const now = new Date();
    setAnchor(now);
    openDay(now);
  };

  const handleRefresh = () => {
    void refetch();
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      <CalendarHeader
        title={formatMonthTitle(anchor)}
        rangeLabel={formatRangeLabel(anchor)}
        category={category}
        onCategoryChange={setCategory}
        onPrev={() => {
          setAnchor((current) => shiftAnchor(current, -1));
        }}
        onNext={() => {
          setAnchor((current) => shiftAnchor(current, 1));
        }}
        onToday={handleToday}
        onRefresh={handleRefresh}
        isRefreshing={isFetching}
      />

      {isLoading ? (
        <Skeleton className="h-[clamp(20rem,60vh,40rem)] w-full" />
      ) : isError ? (
        <div className="flex min-h-[clamp(20rem,60vh,40rem)] items-center justify-center">
          <ErrorState title="Unable to load events" retryAction={handleRefresh} />
        </div>
      ) : (
        <MonthGrid
          days={gridDays}
          monthDate={anchor}
          selectedDate={selectedDate ?? anchor}
          eventsByDay={eventsByDay}
          onSelectDate={selectDay}
        />
      )}
    </div>
  );
}
