import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { CalendarQuery } from "@0xsignal/shared";

import { queryKeys } from "@/lib/query-keys";
import { getCalendar } from "@/services/api/calendar";

const CALENDAR_STALE_TIME = 5 * 60 * 1000;

export interface CalendarEventsQueryOptions {
  /** Keep the previous month rendered while the next month request is in flight. */
  readonly keepPreviousData?: boolean;
  /** Disable the request when a day can be derived from the cached month. */
  readonly enabled?: boolean;
}

export function calendarEventsQueryOptions(
  query: CalendarQuery,
  options: CalendarEventsQueryOptions = {},
) {
  return {
    queryKey: queryKeys.calendar.list(query),
    queryFn: () => getCalendar(query),
    staleTime: CALENDAR_STALE_TIME,
    ...(options.keepPreviousData === true ? { placeholderData: keepPreviousData } : {}),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
  };
}

export function useCalendarEvents(query: CalendarQuery, options: CalendarEventsQueryOptions = {}) {
  return useQuery(calendarEventsQueryOptions(query, options));
}
