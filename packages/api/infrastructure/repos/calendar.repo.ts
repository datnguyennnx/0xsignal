import { Context, Data, Effect, Layer } from "effect";
import type { CalendarQuery, EconomicEvent } from "@0xsignal/shared";
import { PostgresConnectionPool } from "@0xsignal/auth";
import { pgCalendarRepo } from "./calendar.repo.pg";

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

export const CalendarRepoLayer: Layer.Layer<CalendarRepo, never, PostgresConnectionPool> =
  Layer.effect(
    CalendarRepo,
    Effect.gen(function* () {
      const pg = yield* PostgresConnectionPool;

      if (pg === null) {
        return yield* Effect.die(
          new Error("PostgresConnectionPool required but was null — provide a proper pool"),
        );
      }

      return pgCalendarRepo(pg);
    }),
  );
