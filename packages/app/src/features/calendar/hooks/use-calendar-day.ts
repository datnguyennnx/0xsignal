import { useQuery } from "@tanstack/react-query";
import type { CalendarApiResponse, EconomicEvent } from "@0xsignal/shared";
import { endOfDay, startOfDay } from "date-fns";

import type { AsyncState } from "@/lib/async-state";
import { queryKeys } from "@/lib/query-keys";
import { getCalendar } from "@/services/api/calendar";

import { getMonthCalendarQuery, selectDayEventsFromMonth } from "../lib/date-utils";
import { useCalendarEvents } from "./use-calendar-data";

function toEventsState(state: AsyncState<CalendarApiResponse>): AsyncState<EconomicEvent[]> {
  switch (state.status) {
    case "idle":
      return state;
    case "loading":
      return state.stale === undefined
        ? { status: "loading" }
        : { status: "loading", stale: state.stale.events };
    case "ready":
      return { status: "ready", data: state.data.events, stale: state.stale };
    case "empty":
      return {
        status: "empty",
        reason: state.reason,
        ...(state.stale === undefined ? {} : { stale: state.stale }),
      };
    case "error":
      return state;
  }
  return state;
}

function deriveDayState(
  monthEvents: EconomicEvent[] | null,
  ownState: AsyncState<EconomicEvent[]>,
): AsyncState<EconomicEvent[]> {
  if (monthEvents === null) return ownState;
  if (monthEvents.length === 0) return { status: "empty", reason: "no-results" };
  return { status: "ready", data: monthEvents, stale: false };
}

export interface CalendarDayEvents {
  state: AsyncState<EconomicEvent[]>;
  onRetry: () => void;
}

/**
 * Day events read through the board's month cache; the day query only runs when
 * that cache misses. One owner decides the panel's state.
 */
export function useCalendarDay(id: string, day: Date): CalendarDayEvents {
  const monthQuery = getMonthCalendarQuery(day);
  const month = useQuery({
    queryKey: queryKeys.calendar.list(monthQuery),
    queryFn: () => getCalendar(monthQuery),
    enabled: false,
  });

  const monthEvents = selectDayEventsFromMonth(month.data, id);
  const needsOwnFetch = monthEvents === null;

  const query = {
    from: startOfDay(day).toISOString(),
    to: endOfDay(day).toISOString(),
  };

  const { state: ownState, refetch } = useCalendarEvents(query, {
    enabled: needsOwnFetch,
    emptyReason: "no-results",
  });

  return {
    state: deriveDayState(monthEvents, toEventsState(ownState)),
    onRetry: () => {
      void refetch();
    },
  };
}
