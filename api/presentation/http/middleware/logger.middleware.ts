import { Effect } from "effect";
import { Logger } from "../../../infrastructure/logging/console.logger";
import { AppLayer } from "../../../infrastructure/layers/app.layer";

export const logRequest = (
  method: string,
  path: string,
  queryParams: Record<string, string>,
  requestId: string
) =>
  Effect.gen(function* () {
    const logger = yield* Logger;
    const queryStr =
      Object.keys(queryParams).length > 0 ? `?${new URLSearchParams(queryParams).toString()}` : "";
    yield* logger.info(`→ ${method} ${path}${queryStr}`, { requestId });
  });

export const logResponse = (path: string, duration: number, requestId: string) =>
  Effect.runFork(
    Effect.provide(
      Effect.gen(function* () {
        const logger = yield* Logger;
        yield* logger.info(`← 200 ${path} (${duration}ms)`, { requestId });
      }),
      AppLayer
    ) as Effect.Effect<void, never, never>
  );

export const logError = (
  path: string,
  status: number,
  duration: number,
  errorMsg: string,
  requestId: string
) =>
  Effect.runFork(
    Effect.provide(
      Effect.gen(function* () {
        const logger = yield* Logger;
        yield* logger.error(`← ${status} ${path} (${duration}ms) - ${errorMsg}`, { requestId });
      }),
      AppLayer
    ) as Effect.Effect<void, never, never>
  );
