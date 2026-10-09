import { Effect, Layer } from "effect";
import type { CalendarQuery, CalendarSource, EconomicEvent } from "@0xsignal/shared";
import { CalendarRepo } from "../../infrastructure/repos/calendar.repo";
import { CalendarSources } from "../../infrastructure/data-sources/calendar-source";
import { CalendarService, CalendarServiceError } from "./contracts";

const mapRepoError =
  (message: string) =>
  (cause: unknown): CalendarServiceError =>
    new CalendarServiceError({ message, cause });

const NO_EVENTS: readonly EconomicEvent[] = [];

export const makeCalendarService = () =>
  Effect.gen(function* () {
    const repo = yield* CalendarRepo;
    const providers = yield* CalendarSources;

    return CalendarService.of({
      ingest: () =>
        Effect.gen(function* () {
          const results = yield* Effect.forEach(
            providers,
            (provider) =>
              provider.fetchEvents().pipe(
                Effect.map((events) => ({
                  source: provider.source,
                  events,
                  succeeded: true as const,
                })),
                Effect.catch((error) =>
                  Effect.logWarning(
                    `[calendar] source ${provider.source} failed: ${error.message}`,
                  ).pipe(
                    Effect.as({
                      source: provider.source,
                      events: NO_EVENTS,
                      succeeded: false as const,
                    }),
                  ),
                ),
              ),
            { concurrency: "unbounded" },
          );

          const events: EconomicEvent[] = [];
          const sources: CalendarSource[] = [];
          for (const result of results) {
            if (!result.succeeded) continue;
            sources.push(result.source);
            for (const event of result.events) events.push(event);
          }

          const inserted = yield* repo
            .upsertMany(events)
            .pipe(Effect.mapError(mapRepoError("Failed to persist calendar events")));

          return { inserted, sources };
        }),

      query: (q: CalendarQuery) =>
        repo.query(q).pipe(Effect.mapError(mapRepoError("Failed to query calendar events"))),

      upcoming: (hours: number) =>
        repo
          .upcoming(hours)
          .pipe(Effect.mapError(mapRepoError("Failed to load upcoming calendar events"))),
    });
  });

export const calendarServiceLayer: Layer.Layer<
  CalendarService,
  never,
  CalendarRepo | CalendarSources
> = Layer.effect(CalendarService, makeCalendarService());
