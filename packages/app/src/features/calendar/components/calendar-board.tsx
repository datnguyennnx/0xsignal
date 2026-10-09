import { useMemo, useState } from "react";
import type { JSX } from "react";
import type { CalendarQuery } from "@0xsignal/shared";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/core/utils/cn";

import { useCalendarEvents } from "../hooks/use-calendar-data";
import {
  dayKey,
  formatMonthTitle,
  formatRangeLabel,
  getMonthGridDays,
  getViewRange,
  shiftAnchor,
  toEventsByDay,
} from "../lib/date-utils";
import { CalendarHeader } from "./calendar-header";
import type { CalendarCategoryFilterValue } from "./calendar-filters";
import { DayDetailPanel } from "./day-detail-panel";
import { MonthGrid } from "./month-grid";

interface CalendarBoardProps {
  className?: string;
}

export function CalendarBoard({ className }: CalendarBoardProps): JSX.Element {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [category, setCategory] = useState<CalendarCategoryFilterValue>("all");

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

  const selectedEvents = selectedDate ? (eventsByDay.get(dayKey(selectedDate)) ?? []) : [];
  const showDayDetail = selectedDate !== null && selectedEvents.length > 0;

  const handleSelectDate = (date: Date) => {
    setSelectedDate((current) =>
      current !== null && dayKey(current) === dayKey(date) ? null : date,
    );
  };

  const handleToday = () => {
    const now = new Date();
    setAnchor(now);
    setSelectedDate(now);
  };

  const handleRefresh = () => {
    void refetch();
  };

  return (
    <div className={cn("flex w-full items-start gap-6", className)}>
      <div className="min-w-0 flex-1 space-y-4">
        <CalendarHeader
          title={formatMonthTitle(anchor)}
          rangeLabel={formatRangeLabel(anchor)}
          category={category}
          onCategoryChange={setCategory}
          onPrev={() => setAnchor((current) => shiftAnchor(current, -1))}
          onNext={() => setAnchor((current) => shiftAnchor(current, 1))}
          onToday={handleToday}
          onRefresh={handleRefresh}
          isRefreshing={isFetching}
        />

        {isLoading ? (
          <Skeleton className="h-[clamp(20rem,60vh,40rem)] w-full" />
        ) : isError ? (
          <ErrorState title="Unable to load events" retryAction={handleRefresh} />
        ) : (
          <MonthGrid
            days={gridDays}
            monthDate={anchor}
            selectedDate={selectedDate ?? anchor}
            eventsByDay={eventsByDay}
            onSelectDate={handleSelectDate}
          />
        )}
      </div>

      {showDayDetail && (
        <DayDetailPanel
          date={selectedDate}
          events={selectedEvents}
          isLoading={isLoading}
          isError={isError}
          onRetry={handleRefresh}
        />
      )}
    </div>
  );
}
