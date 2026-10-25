import { Clock, Effect } from "effect";
import { CalendarService } from "./index";
import type { HttpError } from "../../platform/http/error-response";
import { DEFAULT_UPCOMING_HOURS, parseCalendarQuery, parseUpcomingHoursQuery } from "./query";

type CalendarHttpService = {
  readonly query: (typeof CalendarService.Service)["query"];
  readonly upcoming: (typeof CalendarService.Service)["upcoming"];
};

type RouteHandler = (
  request: Request,
  url: URL,
  calendar: CalendarHttpService,
) => Effect.Effect<Response, HttpError>;

type BuildCalendarRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

export const buildCalendarRoutes = ({
  json,
  mapServiceError,
}: BuildCalendarRoutesParams): Array<{
  method: string;
  path: string;
  handler: RouteHandler;
}> => [
  {
    method: "GET",
    path: "/api/calendar",
    handler: (_request, url, calendar) =>
      Effect.gen(function* () {
        const query = yield* parseCalendarQuery(url.searchParams);
        const events = yield* calendar.query(query).pipe(Effect.mapError(mapServiceError));

        const fetchedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
        return json({
          data: {
            events,
            sources: [...new Set(events.map((event) => event.source))],
            fetchedAt,
          },
        });
      }),
  },
  {
    method: "GET",
    path: "/api/calendar/upcoming",
    handler: (_request, url, calendar) =>
      Effect.gen(function* () {
        const query = yield* parseUpcomingHoursQuery(url.searchParams);
        const events = yield* calendar
          .upcoming(query.hours ?? DEFAULT_UPCOMING_HOURS)
          .pipe(Effect.mapError(mapServiceError));

        const fetchedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
        return json({
          data: {
            events,
            sources: [...new Set(events.map((event) => event.source))],
            fetchedAt,
          },
        });
      }),
  },
];
