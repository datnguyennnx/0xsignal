import { useQuery } from "@tanstack/react-query";
import type { CalendarQuery } from "@0xsignal/shared";

import { queryKeys } from "@/lib/query-keys";
import { api } from "@/services/api";

const CALENDAR_STALE_TIME = 5 * 60 * 1000;

export function useCalendarEvents(query: CalendarQuery) {
  return useQuery({
    queryKey: queryKeys.calendar.list(query),
    queryFn: () => api.calendar.get(query),
    staleTime: CALENDAR_STALE_TIME,
  });
}

export function useUpcomingEvents(hours: number) {
  return useQuery({
    queryKey: queryKeys.calendar.upcoming(hours),
    queryFn: () => api.calendar.upcoming(hours),
    staleTime: CALENDAR_STALE_TIME,
  });
}
