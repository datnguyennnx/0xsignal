import { Context, Data, type Effect } from "effect";
import type { CalendarSource, EconomicEvent } from "@0xsignal/shared";

export class CalendarSourceError extends Data.TaggedError("CalendarSourceError")<{
  readonly source: CalendarSource;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface CalendarSourceProvider {
  readonly source: CalendarSource;
  readonly fetchEvents: () => Effect.Effect<readonly EconomicEvent[], CalendarSourceError>;
}

export class CalendarSources extends Context.Service<
  CalendarSources,
  readonly CalendarSourceProvider[]
>()("CalendarSources") {}
