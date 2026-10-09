import { Effect } from "effect";
import { CalendarService } from "../../../application/calendar/contracts";
import type { HttpError } from "../error-response";
import { parseCalendarQuery, parseUpcomingHours } from "./calendar.query-parsers";

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
        const events = yield* calendar
          .query(parseCalendarQuery(url.searchParams))
          .pipe(Effect.mapError(mapServiceError));

        return json({
          data: {
            events,
            sources: [...new Set(events.map((event) => event.source))],
            fetchedAt: new Date().toISOString(),
          },
        });
      }),
  },
  {
    method: "GET",
    path: "/api/calendar/upcoming",
    handler: (_request, url, calendar) =>
      Effect.gen(function* () {
        const events = yield* calendar
          .upcoming(parseUpcomingHours(url.searchParams))
          .pipe(Effect.mapError(mapServiceError));

        return json({
          data: {
            events,
            sources: [...new Set(events.map((event) => event.source))],
            fetchedAt: new Date().toISOString(),
          },
        });
      }),
  },
];
