import { Clock, Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { CalendarSourceError } from "../../../application/calendar/contracts";
import { getJson } from "../../http/rest-client";
import type { CalendarSourceProvider } from "../calendar-source";
import { SEC_EDGAR_SEARCH_URL, SEC_EDGAR_USER_AGENT, parse } from "./parse";

export const secEdgarProvider: CalendarSourceProvider = {
  source: "sec-edgar",
  fetchEvents: () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const data = yield* getJson(SEC_EDGAR_SEARCH_URL, {
        headers: { "user-agent": SEC_EDGAR_USER_AGENT },
      }).pipe(
        Effect.mapError(
          (cause) =>
            new CalendarSourceError({
              source: "sec-edgar",
              message: "Failed to fetch sec-edgar calendar source",
              cause,
            }),
        ),
        Effect.provide(FetchHttpClient.layer),
      );
      return parse(JSON.stringify(data), { now });
    }),
};
