import { useCallback, useMemo } from "react";
import type { JSX } from "react";
import type { CalendarQuery } from "@0xsignal/shared";

import { useQuery } from "@tanstack/react-query";
import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";

import { ErrorState } from "@/components/error-state";
import type { PanelComponentProps } from "@/components/side-panel";
import { queryKeys } from "@/lib/query-keys";
import { getCalendar } from "@/services/api/calendar";

import { useCalendarEvents } from "../hooks/use-calendar-data";
import { getMonthCalendarQuery, selectDayEventsFromMonth } from "../lib/date-utils";

import { DayDetailPanel } from "./day-detail-panel";

export { CALENDAR_DAY_PANEL } from "@/lib/panel-kind";

function CalendarDayEvents({ id, day }: { id: string; day: Date }): JSX.Element {
  const monthQuery = useMemo(() => getMonthCalendarQuery(day), [day]);

  /**
   * Read-through cache observer: `enabled: false` never fetches, but it keeps
   * this panel subscribed to the board's month entry so a month that is still
   * loading (or refreshes later) resolves into the derived day automatically.
   */
  const month = useQuery({
    queryKey: queryKeys.calendar.list(monthQuery),
    queryFn: () => getCalendar(monthQuery),
    enabled: false,
  });

  const monthEvents = useMemo(() => selectDayEventsFromMonth(month.data, id), [month.data, id]);
  const needsOwnFetch = monthEvents === null;

  const query = useMemo<CalendarQuery>(
    () => ({
      from: startOfDay(day).toISOString(),
      to: endOfDay(day).toISOString(),
    }),
    [day],
  );

  const { data, isLoading, isError, refetch } = useCalendarEvents(query, {
    enabled: needsOwnFetch,
  });

  const events = useMemo(() => {
    if (monthEvents !== null) return monthEvents;
    return selectDayEventsFromMonth(data, id) ?? [];
  }, [monthEvents, data, id]);

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <DayDetailPanel
      date={day}
      events={events}
      isLoading={needsOwnFetch && isLoading}
      isError={needsOwnFetch && isError}
      onRetry={handleRetry}
    />
  );
}

export function CalendarDayPanel({ id }: PanelComponentProps): JSX.Element {
  const day = useMemo(() => parseISO(id), [id]);

  if (!isValid(day)) {
    return <ErrorState title="Unable to load events" />;
  }

  return <CalendarDayEvents id={id} day={day} />;
}
