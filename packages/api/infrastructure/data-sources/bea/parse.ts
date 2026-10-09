import type { EconomicEvent } from "@0xsignal/shared";
import { normalizeEvent, slugify } from "../../../application/calendar/normalizer";
import { asRecord } from "../parse-utils";

export const BEA_SOURCE_URL = "https://apps.bea.gov/API/signup/release_dates.json";
export const BEA_ATTRIBUTION = "U.S. Bureau of Economic Analysis";

export interface ParseOptions {
  readonly fetchedAt?: string | Date;
}

const pickString = (row: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
};

const NAME_KEYS = ["release_name", "release_description", "description", "name", "title"] as const;

const DATE_KEYS = ["date", "release_date", "releaseDate", "scheduled_date", "scheduledAt"] as const;

const extractRows = (data: unknown): readonly unknown[] => {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return [];
  for (const key of ["release_dates", "releases", "dates", "data", "items"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const parseDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildEvent = (name: string, date: Date, options: ParseOptions): EconomicEvent =>
  normalizeEvent({
    source: "bea",
    sourceEventId: `${date.toISOString()}-${slugify(name)}`,
    title: name,
    country: "US",
    currency: "USD",
    category: "macro",
    impact: "medium",
    scheduledAt: date,
    allDay: true,
    sourceUrl: BEA_SOURCE_URL,
    attribution: BEA_ATTRIBUTION,
    fetchedAt: options.fetchedAt,
  });

export const parse = (body: string, options: ParseOptions = {}): readonly EconomicEvent[] => {
  if (typeof body !== "string" || body.trim() === "") return [];

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }

  const events: EconomicEvent[] = [];

  const releases = asRecord(data);
  if (releases) {
    for (const [name, value] of Object.entries(releases)) {
      const entry = asRecord(value);
      if (!entry || Array.isArray(value)) continue;
      const dates = entry["release_dates"];
      if (!Array.isArray(dates)) continue;
      for (const raw of dates) {
        const dateValue =
          typeof raw === "string" ? raw : pickString(asRecord(raw) ?? {}, DATE_KEYS);
        if (!dateValue) continue;
        const date = parseDate(dateValue);
        if (!date) continue;
        events.push(buildEvent(name, date, options));
      }
    }
  }
  if (events.length > 0) return events;

  for (const raw of extractRows(data)) {
    const row = asRecord(raw);
    if (!row) continue;
    const name = pickString(row, NAME_KEYS);
    const dateValue = pickString(row, DATE_KEYS);
    if (!name || !dateValue) continue;
    const date = parseDate(dateValue);
    if (!date) continue;
    events.push(buildEvent(name, date, options));
  }
  return events;
};
