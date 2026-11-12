import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { CalendarQuery } from "@0xsignal/shared";

import { toAsyncState } from "@/lib/async-state";
import { queryKeys } from "@/lib/query-keys";
import { getCalendar } from "@/services/api/calendar";

const CALENDAR_STALE_TIME = 5 * 60 * 1000;

export interface CalendarEventsQueryOptions {
  /** Keep the previous month rendered while the next month request is in flight. */
  readonly keepPreviousData?: boolean;
  /** Disable the request when a day can be derived from the cached month. */
  readonly enabled?: boolean;
  /** An unfiltered month is first-use empty; a filtered one is no-results. */
  readonly emptyReason?: "first-use" | "no-results";
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

function defaultEmptyReason(query: CalendarQuery): "first-use" | "no-results" {
  const hasCategoryFilter = query.category !== undefined && query.category.length > 0;
  return hasCategoryFilter ? "no-results" : "first-use";
}

export function useCalendarEvents(query: CalendarQuery, options: CalendarEventsQueryOptions = {}) {
  const result = useQuery(calendarEventsQueryOptions(query, options));

  const state = toAsyncState({
    enabled: options.enabled ?? true,
    isPending: result.isPending,
    isFetching: result.isFetching,
    isPlaceholderData: result.isPlaceholderData,
    isError: result.isError,
    error: result.error,
    data: result.data,
    isEmpty: (data) => data.events.length === 0,
    emptyReason: options.emptyReason ?? defaultEmptyReason(query),
  });

  return { ...result, state };
}
