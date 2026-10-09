import type {
  CalendarCategory,
  CalendarImpact,
  CalendarSource,
  EconomicEvent,
} from "@0xsignal/shared";

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

export const stableId = (source: CalendarSource, sourceEventId: string): string => {
  const input = `${source}:${sourceEventId}`;
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return `${source}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export interface EventFields {
  readonly source: CalendarSource;
  readonly sourceEventId: string;
  readonly title: string;
  readonly country: string;
  readonly currency?: string | null;
  readonly category: CalendarCategory;
  readonly impact: CalendarImpact;
  readonly scheduledAt: Date | string;
  readonly allDay?: boolean;
  readonly period?: string | null;
  readonly forecast?: string | null;
  readonly previous?: string | null;
  readonly actual?: string | null;
  readonly revised?: string | null;
  readonly sourceUrl?: string | null;
  readonly attribution: string;
  readonly fetchedAt?: Date | string;
}

const toIso = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

export const normalizeEvent = (fields: EventFields): EconomicEvent => ({
  id: stableId(fields.source, fields.sourceEventId),
  source: fields.source,
  sourceEventId: fields.sourceEventId,
  title: fields.title,
  country: fields.country,
  currency: fields.currency ?? null,
  category: fields.category,
  impact: fields.impact,
  scheduledAt: toIso(fields.scheduledAt),
  allDay: fields.allDay ?? false,
  period: fields.period ?? null,
  forecast: fields.forecast ?? null,
  previous: fields.previous ?? null,
  actual: fields.actual ?? null,
  revised: fields.revised ?? null,
  sourceUrl: fields.sourceUrl ?? null,
  attribution: fields.attribution,
  fetchedAt: toIso(fields.fetchedAt ?? new Date()),
});
