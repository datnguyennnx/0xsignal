import { Data, Effect } from "effect";
import { PostgresConnectionPool } from "@0xsignal/auth";

export class CalendarSchemaError extends Data.TaggedError("CalendarSchemaError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS economic_events (
  id text PRIMARY KEY,
  source text NOT NULL,
  source_event_id text NOT NULL,
  title text NOT NULL,
  country text NOT NULL,
  currency text,
  category text NOT NULL,
  impact text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  period text,
  forecast text,
  previous text,
  actual text,
  revised text,
  source_url text,
  attribution text NOT NULL,
  fetched_at timestamptz NOT NULL,
  UNIQUE (source, source_event_id)
)`;

const CREATE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS economic_events_scheduled_at_idx
  ON economic_events (scheduled_at)`;

export const ensureCalendarSchema: Effect.Effect<
  void,
  CalendarSchemaError,
  PostgresConnectionPool
> = Effect.gen(function* () {
  const pool = yield* PostgresConnectionPool;
  if (pool === null) {
    return yield* Effect.fail(
      new CalendarSchemaError({ message: "PostgresConnectionPool is not configured" }),
    );
  }
  yield* Effect.tryPromise({
    try: async () => {
      await pool.query(CREATE_TABLE_SQL);
      await pool.query(CREATE_INDEX_SQL);
    },
    catch: (cause) =>
      new CalendarSchemaError({ message: "Failed to initialize calendar schema", cause }),
  });
});
