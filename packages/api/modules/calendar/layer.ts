import { Duration, Effect, Layer, Schedule } from "effect";
import type { PostgresConnectionPool } from "@0xsignal/auth";
import { CalendarService } from "./index";
import { calendarServiceLayer } from "./service";
import { CalendarConfig, CalendarConfigLayer } from "./config";
import { CalendarSourcesLayer } from "../../integrations/calendar-sources/layer";
import { ensureCalendarSchema } from "./table";
import { CalendarRepoLayer } from "./repo.pg";

// A single ingest pass covers every source, so it runs at the fastest
// configured cadence rather than once per source.
const refreshMinutes = (config: CalendarConfig["Service"]): number =>
  Math.max(1, Math.min(...Object.values(config.refreshMinutes)));

const CalendarIngestLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const config = yield* CalendarConfig;
    const service = yield* CalendarService;

    yield* Effect.forkScoped(
      service.ingest().pipe(
        Effect.catch((error) =>
          Effect.logWarning(`[calendar] scheduled ingest failed: ${error.message}`),
        ),
        Effect.repeat(Schedule.spaced(Duration.minutes(refreshMinutes(config)))),
      ),
    );
  }),
);

const CalendarSchemaLayer = Layer.effectDiscard(
  ensureCalendarSchema.pipe(
    Effect.tapError((error) =>
      Effect.logWarning(`[calendar] schema initialization skipped: ${error.message}`),
    ),
    Effect.ignore,
  ),
);

const CalendarServiceWithInfra = calendarServiceLayer.pipe(
  Layer.provide(Layer.mergeAll(CalendarSourcesLayer, CalendarRepoLayer)),
);

const CalendarStartupLayer = Layer.mergeAll(
  CalendarSchemaLayer,
  CalendarIngestLayer.pipe(Layer.provide(CalendarServiceWithInfra)),
);

export const CalendarLayer: Layer.Layer<CalendarService, never, PostgresConnectionPool> =
  Layer.mergeAll(CalendarServiceWithInfra, CalendarStartupLayer).pipe(
    Layer.provideMerge(CalendarConfigLayer.pipe(Layer.orDie)),
  );
