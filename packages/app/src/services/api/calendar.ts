import type { CalendarApiResponse, CalendarQuery } from "@0xsignal/shared";
import { API_BASE, fetchJson } from "./client";

export function getCalendar(q: CalendarQuery): Promise<CalendarApiResponse> {
  const query = new URLSearchParams();
  if (q.from !== undefined) query.set("from", q.from);
  if (q.to !== undefined) query.set("to", q.to);
  if (q.impact !== undefined) query.set("impact", q.impact.join(","));
  if (q.category !== undefined) query.set("category", q.category.join(","));
  if (q.currency !== undefined) query.set("currency", q.currency.join(","));
  if (q.limit !== undefined) query.set("limit", String(q.limit));
  const qs = query.toString();
  return fetchJson<CalendarApiResponse>(`${API_BASE}/calendar?${qs}`);
}

export function getUpcomingCalendar(hours: number): Promise<CalendarApiResponse> {
  return fetchJson<CalendarApiResponse>(`${API_BASE}/calendar/upcoming?hours=${hours}`);
}
