import { useQuery } from "@tanstack/react-query";
import type { CalendarQuery } from "@0xsignal/shared";

import { queryKeys } from "@/lib/query-keys";
import { getCalendar } from "@/services/api/calendar";

const CALENDAR_STALE_TIME = 5 * 60 * 1000;

export function useCalendarEvents(query: CalendarQuery) {
  return useQuery({
    queryKey: queryKeys.calendar.list(query),
    queryFn: () => getCalendar(query),
    staleTime: CALENDAR_STALE_TIME,
  });
}
