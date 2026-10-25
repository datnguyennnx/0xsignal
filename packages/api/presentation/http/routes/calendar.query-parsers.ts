import { Schema, SchemaGetter } from "effect";
import {
  NormalizedEnumList,
  PositiveIntegerFromQuery,
  parseQuery,
  splitQueryList,
} from "../utils/param-parsers";

const CALENDAR_IMPACTS = ["low", "medium", "high"] as const;
const CALENDAR_CATEGORIES = ["macro", "crypto", "fx"] as const;

export const DEFAULT_UPCOMING_HOURS = 24;

const impactsFromQuery = NormalizedEnumList(CALENDAR_IMPACTS);

const categoriesFromQuery = NormalizedEnumList(CALENDAR_CATEGORIES);

const currenciesFromQuery = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(Schema.String).pipe(Schema.mutable), {
    decode: SchemaGetter.transform((raw: string) =>
      splitQueryList(raw).map((token) => token.toUpperCase()),
    ),
    encode: SchemaGetter.transform((currency: string[]) => currency.join(",")),
  }),
);

const isoInstantFromQuery = Schema.DateFromString.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((date: Date) => date.toISOString()),
    encode: SchemaGetter.transform((iso: string) => new Date(iso)),
  }),
);

const calendarEventsQuery = Schema.Struct({
  from: Schema.optionalKey(isoInstantFromQuery),
  to: Schema.optionalKey(isoInstantFromQuery),
  impact: Schema.optionalKey(impactsFromQuery),
  category: Schema.optionalKey(categoriesFromQuery),
  currency: Schema.optionalKey(currenciesFromQuery),
  limit: Schema.optionalKey(PositiveIntegerFromQuery),
});

const calendarUpcomingQuery = Schema.Struct({
  hours: Schema.optionalKey(PositiveIntegerFromQuery),
});

export const parseCalendarQuery = (searchParams: URLSearchParams) =>
  parseQuery(searchParams, calendarEventsQuery);

export const parseUpcomingHoursQuery = (searchParams: URLSearchParams) =>
  parseQuery(searchParams, calendarUpcomingQuery);
