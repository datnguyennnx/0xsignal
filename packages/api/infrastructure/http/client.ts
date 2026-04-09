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

import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform";

// Implementation using @effect/platform/HttpClient
export const HttpClientLive = Layer.effect(
  HttpClientTag,
  Effect.gen(function* () {
    const platformClient = yield* HttpClient.HttpClient;

    const executeWithRetry = (request: HttpClientRequest.HttpClientRequest) =>
      platformClient.execute(request).pipe(
        Effect.flatMap((res) => {
          if (res.status >= 400) {
            return Effect.fail(
              new HttpError({
                message: `HTTP Error ${res.status}`,
                status: res.status,
                url: request.url,
              })
            );
          }
          return Effect.succeed(res);
        }),
        Effect.mapError((e) => {
          if (e instanceof HttpError) return e;
          return new HttpError({
            message: e instanceof Error ? e.message : String(e),
            url: request.url,
          });
        }),
        Effect.retry({ schedule: retrySchedule, while: isRetryable }),
        Effect.withSpan("http.request", {
          attributes: { url: request.url, domain: extractDomain(request.url) },
        })
      );

    return HttpClientTag.of({
      get: <A, I>(
        url: string,
        schema: Schema.Schema<A, I>,
        options?: { headers?: Record<string, string> }
      ) =>
        HttpClientRequest.get(url).pipe(
          HttpClientRequest.setHeaders(options?.headers ?? {}),
          executeWithRetry,
          Effect.flatMap((res) =>
            HttpClientResponse.schemaBodyJson(schema)(res).pipe(
              Effect.mapError(
                (e) =>
                  new HttpParseError({
                    message: `Schema validation failed: ${e}`,
                    url,
                  })
              )
            )
          )
        ),

      getJson: (url: string, options?: { headers?: Record<string, string> }) =>
        HttpClientRequest.get(url).pipe(
          HttpClientRequest.setHeaders(options?.headers ?? {}),
          executeWithRetry,
          Effect.flatMap((response) =>
            response.json.pipe(
              Effect.mapError(() => new HttpError({ message: "Failed to parse JSON", url }))
            )
          )
        ),
    });
  })
);
