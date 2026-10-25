import { Effect, Option } from "effect";
import { CalendarService } from "../../modules/calendar";
import { buildCalendarRoutes } from "../../modules/calendar/http";
import { json } from "../../platform/http/error-response";
import type { Route } from "../../platform/http/route-contracts";
import type { HttpRequestServices } from "../contracts";
import { mapServiceError } from "../error-mapping";

export const calendarRoutes: ReadonlyArray<Route<HttpRequestServices>> = buildCalendarRoutes({
  json,
  mapServiceError,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request, url) =>
    Effect.gen(function* () {
      const calendar = Option.getOrUndefined(yield* Effect.serviceOption(CalendarService));
      return calendar === undefined
        ? json({ error: "Calendar service unavailable" }, 503)
        : yield* route.handler(request, url, calendar);
    }),
}));
