import type { CalendarCategory, CalendarImpact, CalendarQuery } from "@0xsignal/shared";

const IMPACTS: readonly CalendarImpact[] = ["low", "medium", "high"];
const CATEGORIES: readonly CalendarCategory[] = ["macro", "crypto", "fx"];

export const DEFAULT_UPCOMING_HOURS = 24;

const isImpact = (value: string): value is CalendarImpact =>
  (IMPACTS as readonly string[]).includes(value);

const isCategory = (value: string): value is CalendarCategory =>
  (CATEGORIES as readonly string[]).includes(value);

const parseIsoDate = (raw: string | null): string | undefined => {
  if (raw === null) return undefined;
  const value = raw.trim();
  if (value === "") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const parsePositiveInt = (raw: string | null): number | undefined => {
  if (raw === null) return undefined;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const parseEnumList = <T extends string>(
  raw: string | null,
  isMember: (value: string) => value is T,
): T[] | undefined => {
  if (raw === null) return undefined;
  const values = raw
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(isMember);
  return values.length > 0 ? values : undefined;
};

const parseCurrencyList = (raw: string | null): string[] | undefined => {
  if (raw === null) return undefined;
  const values = raw
    .split(",")
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token !== "");
  return values.length > 0 ? values : undefined;
};

export const parseCalendarQuery = (params: URLSearchParams): CalendarQuery => {
  const query: CalendarQuery = {};

  const from = parseIsoDate(params.get("from"));
  if (from !== undefined) query.from = from;
  const to = parseIsoDate(params.get("to"));
  if (to !== undefined) query.to = to;

  const impact = parseEnumList(params.get("impact"), isImpact);
  if (impact !== undefined) query.impact = impact;
  const category = parseEnumList(params.get("category"), isCategory);
  if (category !== undefined) query.category = category;
  const currency = parseCurrencyList(params.get("currency"));
  if (currency !== undefined) query.currency = currency;

  const limit = parsePositiveInt(params.get("limit"));
  if (limit !== undefined) query.limit = limit;

  return query;
};

export const parseUpcomingHours = (params: URLSearchParams): number =>
  parsePositiveInt(params.get("hours")) ?? DEFAULT_UPCOMING_HOURS;
