import { Cause, Duration, Effect, Schedule } from "effect";
import { HttpClient, HttpClientError, HttpClientRequest } from "effect/unstable/http";

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_TIMES = 3;

export interface GetJsonOptions {
  readonly headers?: Record<string, string>;
}

export const getJson = <T>(
  url: string,
  options?: GetJsonOptions,
): Effect.Effect<T, HttpClientError.HttpClientError | Cause.TimeoutError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.get(url).pipe(
      HttpClientRequest.acceptJson,
      HttpClientRequest.setHeaders(options?.headers ?? {}),
    );
    const response = yield* client.execute(request);
    return (yield* response.json) as unknown as T;
  }).pipe(
    Effect.retry({
      schedule: Schedule.exponential("200 millis").pipe(Schedule.upTo({ times: RETRY_TIMES })),
    }),
    Effect.timeout(Duration.millis(DEFAULT_TIMEOUT_MS)),
  );
