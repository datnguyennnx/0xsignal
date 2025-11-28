/**
 * HTTP Client Service
 * Effect-native HTTP client with schema validation, retry, rate limit handling,
 * and request deduplication for maximum performance
 */

import {
  Effect,
  Context,
  Layer,
  Data,
  Duration,
  Schedule,
  Schema,
  Deferred,
  Ref,
  HashMap,
} from "effect";

// HTTP errors
export class HttpError extends Data.TaggedError("HttpError")<{
  readonly message: string;
  readonly status?: number;
  readonly url?: string;
}> {}

export class HttpParseError extends Data.TaggedError("HttpParseError")<{
  readonly message: string;
  readonly url: string;
}> {}

export type HttpClientError = HttpError | HttpParseError;

// In-flight request tracking for deduplication
type InFlightRequest = {
  promise: Promise<{ data: unknown; status: number }>;
  timestamp: number;
};

// HTTP client interface
export interface HttpClient {
  readonly get: <A, I>(
    url: string,
    schema: Schema.Schema<A, I>,
    options?: { headers?: Record<string, string> }
  ) => Effect.Effect<A, HttpClientError>;

  readonly getJson: (
    url: string,
    options?: { headers?: Record<string, string> }
  ) => Effect.Effect<unknown, HttpError>;

  readonly post: <A, I>(
    url: string,
    body: unknown,
    schema: Schema.Schema<A, I>,
    options?: { headers?: Record<string, string> }
  ) => Effect.Effect<A, HttpClientError>;
}

export class HttpClientTag extends Context.Tag("HttpClient")<HttpClientTag, HttpClient>() {}

// Retry policy for transient failures (includes 429 rate limits)
// Exponential backoff: 500ms -> 1s -> 2s with jitter
const retrySchedule = Schedule.exponential(Duration.millis(500)).pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(3))
);

// Check if error is retryable (500+ or 429)
const isRetryable = (e: HttpError): boolean => {
  if (!e.status) return false;
  return e.status >= 500 || e.status === 429;
};

// Extract host and path from URL
const parseUrl = (url: string) => {
  try {
    const u = new URL(url);
    return { host: u.hostname, path: u.pathname };
  } catch {
    return { host: "unknown", path: url };
  }
};

// URL-based request deduplication
const inFlightRequests = new Map<string, InFlightRequest>();

// Cleanup stale requests (older than 30 seconds)
const cleanupStaleRequests = () => {
  const now = Date.now();
  for (const [key, entry] of inFlightRequests.entries()) {
    if (now - entry.timestamp > 30000) {
      inFlightRequests.delete(key);
    }
  }
};

// Run cleanup every 10 seconds
setInterval(cleanupStaleRequests, 10000);

// Core fetch with deduplication
const fetchWithDedup = async (
  url: string,
  options?: RequestInit
): Promise<{ data: unknown; status: number }> => {
  const cacheKey = `${options?.method || "GET"}:${url}`;

  // Check for in-flight request
  const existing = inFlightRequests.get(cacheKey);
  if (existing) {
    return existing.promise;
  }

  // Create new request
  const fetchPromise = (async () => {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new HttpError({
          message: `HTTP ${res.status}: ${res.statusText}`,
          status: res.status,
          url,
        });
      }
      return { data: await res.json(), status: res.status };
    } finally {
      // Clean up after completion
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, {
    promise: fetchPromise,
    timestamp: Date.now(),
  });

  return fetchPromise;
};

// HTTP client implementation
export const HttpClientLive = Layer.succeed(HttpClientTag, {
  get: <A, I>(
    url: string,
    schema: Schema.Schema<A, I>,
    options?: { headers?: Record<string, string> }
  ) =>
    Effect.gen(function* () {
      const startTime = Date.now();
      const { host, path } = parseUrl(url);

      const response = yield* Effect.tryPromise({
        try: () => fetchWithDedup(url, { headers: options?.headers }),
        catch: (error) =>
          error instanceof HttpError
            ? error
            : new HttpError({
                message: error instanceof Error ? error.message : "Network error",
                url,
              }),
      }).pipe(
        Effect.retry({
          schedule: retrySchedule,
          while: isRetryable,
        })
      );

      // Log external API call
      const duration = Date.now() - startTime;
      yield* Effect.logDebug(`↗ GET ${host}${path} ${response.status} (${duration}ms)`);

      return yield* Schema.decodeUnknown(schema)(response.data).pipe(
        Effect.mapError(
          (e) =>
            new HttpParseError({
              message: `Schema validation failed: ${e.message}`,
              url,
            })
        )
      );
    }),

  getJson: (url: string, options?: { headers?: Record<string, string> }) =>
    Effect.gen(function* () {
      const startTime = Date.now();
      const { host, path } = parseUrl(url);

      const response = yield* Effect.tryPromise({
        try: () => fetchWithDedup(url, { headers: options?.headers }),
        catch: (error) =>
          error instanceof HttpError
            ? error
            : new HttpError({
                message: error instanceof Error ? error.message : "Network error",
                url,
              }),
      }).pipe(
        Effect.retry({
          schedule: retrySchedule,
          while: isRetryable,
        })
      );

      // Log external API call
      const duration = Date.now() - startTime;
      yield* Effect.logDebug(`↗ GET ${host}${path} ${response.status} (${duration}ms)`);

      return response.data;
    }),

  post: <A, I>(
    url: string,
    body: unknown,
    schema: Schema.Schema<A, I>,
    options?: { headers?: Record<string, string> }
  ) =>
    Effect.gen(function* () {
      const startTime = Date.now();
      const { host, path } = parseUrl(url);

      // POST requests are not deduplicated (mutations)
      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...options?.headers },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            throw new HttpError({
              message: `HTTP ${res.status}: ${res.statusText}`,
              status: res.status,
              url,
            });
          }
          return { data: await res.json(), status: res.status };
        },
        catch: (error) =>
          error instanceof HttpError
            ? error
            : new HttpError({
                message: error instanceof Error ? error.message : "Network error",
                url,
              }),
      }).pipe(
        Effect.retry({
          schedule: retrySchedule,
          while: isRetryable,
        })
      );

      // Log external API call
      const duration = Date.now() - startTime;
      yield* Effect.logDebug(`↗ POST ${host}${path} ${response.status} (${duration}ms)`);

      return yield* Schema.decodeUnknown(schema)(response.data).pipe(
        Effect.mapError(
          (e) =>
            new HttpParseError({
              message: `Schema validation failed: ${e.message}`,
              url,
            })
        )
      );
    }),
});
