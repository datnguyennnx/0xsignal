import { Context, Data, type Effect } from "effect";
import type { CalendarQuery, CalendarSource, EconomicEvent } from "@0xsignal/shared";

export class CalendarSourceError extends Data.TaggedError("CalendarSourceError")<{
  readonly source: CalendarSource;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class CalendarServiceError extends Data.TaggedError("CalendarServiceError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface CalendarServicePort {
  readonly ingest: () => Effect.Effect<
    { readonly inserted: number; readonly sources: readonly CalendarSource[] },
    CalendarServiceError
  >;
  readonly query: (
    q: CalendarQuery,
  ) => Effect.Effect<readonly EconomicEvent[], CalendarServiceError>;
  readonly upcoming: (
    hours: number,
  ) => Effect.Effect<readonly EconomicEvent[], CalendarServiceError>;
}

export class CalendarService extends Context.Service<CalendarService, CalendarServicePort>()(
  "CalendarService",
) {}
