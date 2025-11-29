/** HTTP Client Service - Schema validation, retry, and tracing */

import { Effect, Context, Layer, Data, Duration, Schedule, Schema, pipe } from "effect";

// Errors
export class HttpError extends Data.TaggedError("HttpError")<{
  readonly message: string;
  readonly status?: number;
  readonly url?: string;
}> {}

export class HttpParseError extends Data.TaggedError("HttpParseError")<{
  readonly message: string;
  readonly url: string;
}> {}

export type AppHttpClientError = HttpError | HttpParseError;

// Service interface
export interface AppHttpClient {
  readonly get: <A, I>(
    url: string,
    schema: Schema.Schema<A, I>,
    options?: { headers?: Record<string, string> }
  ) => Effect.Effect<A, AppHttpClientError>;

  readonly getJson: (
    url: string,
    options?: { headers?: Record<string, string> }
  ) => Effect.Effect<unknown, HttpError>;

  readonly post: <A, I>(
    url: string,
    body: unknown,
    schema: Schema.Schema<A, I>,
    options?: { headers?: Record<string, string> }
  ) => Effect.Effect<A, AppHttpClientError>;
}

export class HttpClientTag extends Context.Tag("HttpClient")<HttpClientTag, AppHttpClient>() {}

// Retry: exponential backoff with jitter, 3 attempts
const retrySchedule = pipe(
  Schedule.exponential(Duration.millis(500)),
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(3))
);

// Retryable status codes: 5xx and 429
const isRetryable = (e: AppHttpClientError): boolean =>
  e._tag === "HttpError" && !!e.status && (e.status >= 500 || e.status === 429);

// Extract domain from URL for tracing
const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
};

// Fetch helpers
const fetchResponse = (url: string, init?: RequestInit) =>
  Effect.tryPromise({
    try: () => fetch(url, init),
    catch: (e) => new HttpError({ message: e instanceof Error ? e.message : "Network error", url }),
  });

const checkStatus = (response: Response, url: string) =>
  response.ok
    ? Effect.succeed(response)
    : Effect.fail(
        new HttpError({
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          url,
        })
      );

const parseJson = (response: Response, url: string) =>
  Effect.tryPromise({
    try: () => response.json(),
    catch: () => new HttpParseError({ message: "Failed to parse JSON", url }),
  });

const decodeSchema = <A, I>(schema: Schema.Schema<A, I>, data: unknown, url: string) =>
  Schema.decodeUnknown(schema)(data).pipe(
    Effect.mapError(
      (e) => new HttpParseError({ message: `Schema validation failed: ${e.message}`, url })
    )
  );

// Implementation
export const HttpClientLive = Layer.succeed(HttpClientTag, {
  get: <A, I>(
    url: string,
    schema: Schema.Schema<A, I>,
    options?: { headers?: Record<string, string> }
  ) =>
    Effect.gen(function* () {
      const response = yield* fetchResponse(url, { headers: options?.headers });
      yield* checkStatus(response, url);
      const data = yield* parseJson(response, url);
      return yield* decodeSchema(schema, data, url);
    }).pipe(
      Effect.retry({ schedule: retrySchedule, while: isRetryable }),
      Effect.withSpan("http.get", { attributes: { url, domain: extractDomain(url) } })
    ),

  getJson: (url: string, options?: { headers?: Record<string, string> }) =>
    Effect.gen(function* () {
      const response = yield* fetchResponse(url, { headers: options?.headers });
      yield* checkStatus(response, url);
      return yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => new HttpError({ message: "Failed to parse JSON", url }),
      });
    }).pipe(
      Effect.retry({ schedule: retrySchedule, while: isRetryable }),
      Effect.withSpan("http.getJson", { attributes: { url, domain: extractDomain(url) } })
    ),

  post: <A, I>(
    url: string,
    body: unknown,
    schema: Schema.Schema<A, I>,
    options?: { headers?: Record<string, string> }
  ) =>
    Effect.gen(function* () {
      const response = yield* fetchResponse(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...options?.headers },
        body: JSON.stringify(body),
      });
      yield* checkStatus(response, url);
      const data = yield* parseJson(response, url);
      return yield* decodeSchema(schema, data, url);
    }).pipe(
      Effect.retry({ schedule: retrySchedule, while: isRetryable }),
      Effect.withSpan("http.post", { attributes: { url, domain: extractDomain(url) } })
    ),
});
