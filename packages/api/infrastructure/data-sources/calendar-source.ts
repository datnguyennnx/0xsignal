import { Context, Effect } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientError,
  HttpClientRequest,
} from "effect/unstable/http";
import type { CalendarSource, EconomicEvent } from "@0xsignal/shared";
import { CalendarSourceError } from "../../application/calendar/contracts";

export interface CalendarSourceProvider {
  readonly source: CalendarSource;
  readonly fetchEvents: () => Effect.Effect<readonly EconomicEvent[], CalendarSourceError>;
}

export class CalendarSources extends Context.Service<
  CalendarSources,
  readonly CalendarSourceProvider[]
>()("CalendarSources") {}

const fetchText = (
  url: string,
): Effect.Effect<string, HttpClientError.HttpClientError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.get(url).pipe(
      HttpClientRequest.setHeaders({
        accept: "text/html, text/calendar, application/json;q=0.9, */*;q=0.8",
      }),
    );
    const response = yield* client.execute(request);
    return yield* response.text;
  });

export const fetchSourceText = (
  source: CalendarSource,
  url: string,
): Effect.Effect<string, CalendarSourceError> =>
  fetchText(url).pipe(
    Effect.mapError(
      (cause) =>
        new CalendarSourceError({
          source,
          message: `Failed to fetch ${source} calendar source`,
          cause,
        }),
    ),
    Effect.provide(FetchHttpClient.layer),
  );
