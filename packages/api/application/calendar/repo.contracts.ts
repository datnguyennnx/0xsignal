import { Context, Data, type Effect } from "effect";
import type { CalendarQuery, EconomicEvent } from "@0xsignal/shared";

export class CalendarRepoError extends Data.TaggedError("CalendarRepoError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface CalendarRepoPort {
  readonly upsertMany: (
    events: readonly EconomicEvent[],
  ) => Effect.Effect<number, CalendarRepoError>;

  readonly query: (q: CalendarQuery) => Effect.Effect<readonly EconomicEvent[], CalendarRepoError>;

  readonly upcoming: (hours: number) => Effect.Effect<readonly EconomicEvent[], CalendarRepoError>;
}

export class CalendarRepo extends Context.Service<CalendarRepo, CalendarRepoPort>()(
  "CalendarRepo",
) {}
