import { useCallback, useMemo } from "react";
import type { JSX } from "react";
import type { CalendarQuery } from "@0xsignal/shared";

import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";

import { ErrorState } from "@/components/error-state";
import type { PanelComponentProps } from "@/components/side-panel";

import { useCalendarEvents } from "../hooks/use-calendar-data";
import { dayKey } from "../lib/date-utils";

import { DayDetailPanel } from "./day-detail-panel";

export const CALENDAR_DAY_PANEL = "calendar-day";

function CalendarDayEvents({ id, day }: { id: string; day: Date }): JSX.Element {
  const query = useMemo<CalendarQuery>(
    () => ({
      from: startOfDay(day).toISOString(),
      to: endOfDay(day).toISOString(),
    }),
    [day],
  );

  const { data, isLoading, isError, refetch } = useCalendarEvents(query);

  const events = useMemo(
    () => (data?.events ?? []).filter((event) => dayKey(new Date(event.scheduledAt)) === id),
    [data, id],
  );

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <DayDetailPanel
      date={day}
      events={events}
      isLoading={isLoading}
      isError={isError}
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
