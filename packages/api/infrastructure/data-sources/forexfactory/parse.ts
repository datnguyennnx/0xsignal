import type { CalendarImpact, EconomicEvent } from "@0xsignal/shared";
import { normalizeEvent, slugify } from "../../../application/calendar/normalizer";
import { asRecord } from "../parse-utils";

export const FOREXFACTORY_SOURCE_URL = "https://www.forexfactory.com/calendar";
export const FOREXFACTORY_FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
export const FOREXFACTORY_ATTRIBUTION = "ForexFactory";

export interface ParseOptions {
  readonly fetchedAt?: string | Date;
}

const CURRENCY_COUNTRY: Record<string, string> = {
  USD: "US",
  EUR: "EU",
  GBP: "GB",
  JPY: "JP",
  AUD: "AU",
  CAD: "CA",
  CHF: "CH",
  NZD: "NZ",
  CNY: "CN",
};

const IMPACT_BY_LABEL: Record<string, CalendarImpact> = {
  high: "high",
  medium: "medium",
  low: "low",
  holiday: "low",
};

const asTrimmedString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

const parseImpact = (value: unknown): CalendarImpact => {
  const label = asTrimmedString(value)?.toLowerCase() ?? "";
  return IMPACT_BY_LABEL[label] ?? "low";
};

const parseDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildEvent = (row: Record<string, unknown>, options: ParseOptions): EconomicEvent | null => {
  const title = asTrimmedString(row["title"]);
  const dateValue = asTrimmedString(row["date"]);
  if (!title || !dateValue) return null;
  const date = parseDate(dateValue);
  if (!date) return null;

  const rawCountry = asTrimmedString(row["country"]);
  const currency = rawCountry && /^[A-Z]{3}$/.test(rawCountry) ? rawCountry : null;
  const country = currency ? (CURRENCY_COUNTRY[currency] ?? currency) : "US";

  return normalizeEvent({
    source: "forexfactory",
    sourceEventId: `${date.toISOString()}-${currency ?? "xx"}-${slugify(title)}`,
    title,
    country,
    currency,
    category: "fx",
    impact: parseImpact(row["impact"]),
    scheduledAt: date,
    forecast: asTrimmedString(row["forecast"]),
    previous: asTrimmedString(row["previous"]),
    sourceUrl: FOREXFACTORY_SOURCE_URL,
    attribution: FOREXFACTORY_ATTRIBUTION,
    fetchedAt: options.fetchedAt,
  });
};

export const parse = (body: string, options: ParseOptions = {}): readonly EconomicEvent[] => {
  if (typeof body !== "string" || body.trim() === "") return [];

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const events: EconomicEvent[] = [];
  for (const raw of data) {
    const row = asRecord(raw);
    if (!row) continue;
    const event = buildEvent(row, options);
    if (event) events.push(event);
  }
  return events;
};
