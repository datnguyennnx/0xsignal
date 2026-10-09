export type CalendarImpact = "low" | "medium" | "high";
export type CalendarCategory = "macro" | "crypto" | "fx";
export type CalendarSource = "bls" | "bea" | "federal-reserve" | "forexfactory" | "sec-edgar";

export interface EconomicEvent {
  id: string;
  source: CalendarSource;
  sourceEventId: string;
  title: string;
  country: string;
  currency: string | null;
  category: CalendarCategory;
  impact: CalendarImpact;
  scheduledAt: string;
  allDay: boolean;
  period: string | null;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  revised: string | null;
  sourceUrl: string | null;
  attribution: string;
  fetchedAt: string;
}

export interface CalendarQuery {
  from?: string;
  to?: string;
  impact?: CalendarImpact[];
  currency?: string[];
  category?: CalendarCategory[];
  limit?: number;
}

export interface CalendarApiResponse {
  events: EconomicEvent[];
  sources: CalendarSource[];
  fetchedAt: string;
}
