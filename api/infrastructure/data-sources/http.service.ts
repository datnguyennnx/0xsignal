/**
 * HTTP Service
 * Shared HTTP client for all data sources
 */

import { Effect, Context, Layer, Data } from "effect";
import { Logger } from "../logging/console.logger";

// ============================================================================
// HTTP Error
// ============================================================================

export class HttpError extends Data.TaggedError("HttpError")<{
  readonly message: string;
  readonly status?: number;
  readonly url?: string;
}> {}

// ============================================================================
// HTTP Service Tag
// ============================================================================

export class HttpService extends Context.Tag("HttpService")<
  HttpService,
  {
    readonly get: (
      url: string,
      headers?: Record<string, string>
    ) => Effect.Effect<unknown, HttpError>;
    readonly post: (
      url: string,
      body: unknown,
      headers?: Record<string, string>
    ) => Effect.Effect<unknown, HttpError>;
  }
>() {}

// ============================================================================
// HTTP Service Implementation
// ============================================================================

export const HttpServiceLive = Layer.effect(
  HttpService,
  Effect.gen(function* () {
    const logger = yield* Logger;

    return {
      get: (url, headers = {}) =>
        Effect.gen(function* () {
          const startTime = Date.now();
          const urlObj = new URL(url);
          const host = urlObj.hostname;
          const path = urlObj.pathname;

          const result = yield* Effect.tryPromise({
            try: async () => {
              const response = await fetch(url, { headers });
              const duration = Date.now() - startTime;

              if (!response.ok) {
                throw new HttpError({
                  message: `HTTP ${response.status}: ${response.statusText}`,
                  status: response.status,
                  url,
                });
              }

              return { data: await response.json(), status: response.status, duration };
            },
            catch: (error) =>
              error instanceof HttpError
                ? error
                : new HttpError({
                    message: error instanceof Error ? error.message : "Unknown HTTP error",
                    status: undefined,
                    url,
                  }),
          });

          yield* logger.info(
            `↗ External API GET ${host}${path} ${result.status} (${result.duration}ms)`
          );

          return result.data;
        }),

      post: (url, body, headers = {}) =>
        Effect.gen(function* () {
          const startTime = Date.now();
          const urlObj = new URL(url);
          const host = urlObj.hostname;
          const path = urlObj.pathname;

          const result = yield* Effect.tryPromise({
            try: async () => {
              const response = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...headers,
                },
                body: JSON.stringify(body),
              });
              const duration = Date.now() - startTime;

              if (!response.ok) {
                throw new HttpError({
                  message: `HTTP ${response.status}: ${response.statusText}`,
                  status: response.status,
                  url,
                });
              }

              return { data: await response.json(), status: response.status, duration };
            },
            catch: (error) =>
              error instanceof HttpError
                ? error
                : new HttpError({
                    message: error instanceof Error ? error.message : "Unknown HTTP error",
                    status: undefined,
                    url,
                  }),
          });

          yield* logger.info(
            `↗ External API POST ${host}${path} ${result.status} (${result.duration}ms)`
          );

          return result.data;
        }),
    };
  })
);
