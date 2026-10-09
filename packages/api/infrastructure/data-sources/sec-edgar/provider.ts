import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { CalendarSourceError } from "../../../application/calendar/contracts";
import { getJson } from "../../http/rest-client";
import type { CalendarSourceProvider } from "../calendar-source";
import { SEC_EDGAR_SEARCH_URL, SEC_EDGAR_USER_AGENT, parse } from "./parse";

export const secEdgarProvider: CalendarSourceProvider = {
  source: "sec-edgar",
  fetchEvents: () =>
    getJson<unknown>(SEC_EDGAR_SEARCH_URL, {
      headers: { "user-agent": SEC_EDGAR_USER_AGENT },
    }).pipe(
      Effect.map((data) => parse(JSON.stringify(data))),
      Effect.mapError(
        (cause) =>
          new CalendarSourceError({
            source: "sec-edgar",
            message: "Failed to fetch sec-edgar calendar source",
            cause,
          }),
      ),
      Effect.provide(FetchHttpClient.layer),
    ),
};
