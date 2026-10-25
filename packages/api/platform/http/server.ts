import type { Server } from "bun";
import { Config, Effect } from "effect";
import type { ManagedRuntime } from "effect/ManagedRuntime";
import type { CorsConfig } from "./cors";
import type { HttpError } from "./error-response";
import { createFetchHandler } from "./fetch-handler";
import { createRouter } from "./router";
import type { Route } from "./route-contracts";
import type { WsSetup } from "./ws";

export interface ServerDeps<R, D> {
  readonly runtime: ManagedRuntime<R, unknown>;
  readonly routes: ReadonlyArray<Route<R>>;
  readonly cors: CorsConfig;
  readonly ws: WsSetup<D>;
  readonly mapError: (error: unknown) => HttpError;
}

/**
 * Starts the Bun HTTP server. The app (routes + runtime) arrives as a
 * parameter so this transport layer never imports the composition root.
 */
export const serve = async <R, D>(deps: ServerDeps<R, D>, signal: AbortSignal): Promise<void> => {
  const handleRequest = createRouter(deps.routes);
  const fetchHandler = createFetchHandler(
    (effect) => deps.runtime.runPromise(effect),
    deps.cors,
    deps.ws,
    deps.mapError,
    handleRequest,
  );

  const serverProgram = Effect.gen(function* () {
    const PORT = yield* Config.Int("PORT").pipe(Config.withDefault(9006));

    yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve<D>({
          port: PORT,
          fetch: fetchHandler,
          websocket: deps.ws.handlers,
          reusePort: true,
          // Kept in step with the handler heartbeat so the transport and the
          // application agree on when a peer is gone.
          idleTimeout: deps.ws.idleTimeoutSeconds,
        }),
      ),
      (s: Server<D>) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Shutting down server...");
          yield* Effect.promise(() => s.stop());
        }),
    );

    yield* Effect.logInfo(`0xSignal API Server`);
    yield* Effect.logInfo(`Server: http://localhost:${PORT}`);
    yield* Effect.logInfo(`Health: http://localhost:${PORT}/api/health`);

    yield* Effect.never;
  });

  try {
    await deps.runtime.runPromise(serverProgram.pipe(Effect.scoped), { signal });
  } catch (cause) {
    if (signal.aborted) return;
    console.error("Fatal error:", cause);
    throw cause;
  }
};
