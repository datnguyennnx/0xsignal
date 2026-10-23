import { Effect, Layer } from "effect";
import { PostgresConnectionPool } from "@0xsignal/auth";
import { CalendarRepo } from "../../application/calendar/repo.contracts";
import { pgCalendarRepo } from "./calendar.repo.pg";

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
