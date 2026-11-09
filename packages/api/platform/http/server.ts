import type { Server, ServerWebSocket, WebSocketHandler } from "bun";
import { Config, Effect } from "effect";
import type { ManagedRuntime } from "effect/ManagedRuntime";
import type { CorsConfig } from "./cors";
import type { HttpError } from "./error-response";
import { createConnectionCap, createFetchHandler, type ConnectionCap } from "./fetch-handler";
import { createRouter } from "./router";
import type { Route } from "./route-contracts";
import type { WsEventHandlers, WsSetup } from "./ws";

/** Matches the largest frame the app sends and bounds one inbound message. */
export const MAX_WS_PAYLOAD_BYTES = 1024 * 1024;
/** A peer that queues this much outbound data is closed instead of buffered. */
export const WS_BACKPRESSURE_LIMIT_BYTES = 1024 * 1024;
/** Conservative ceiling: one process must not serve unbounded sockets. */
export const MAX_WS_CONNECTIONS = 1024;

/**
 * The Bun `websocket` option fragment that caps frame size and backpressure.
 * Exported so the transport limits are asserted directly in tests.
 */
export const WS_SERVE_OPTIONS = {
  maxPayloadLength: MAX_WS_PAYLOAD_BYTES,
  backpressureLimit: WS_BACKPRESSURE_LIMIT_BYTES,
  closeOnBackpressureLimit: true,
} as const;

/**
 * Frees the connection slot exactly once. Error and close can both fire for the
 * same socket, so identity — not the callback — decides who releases it.
 */
export const capWsHandlers = <D>(
  handlers: WsEventHandlers<D>,
  cap: ConnectionCap,
): WsEventHandlers<D> => {
  const released = new WeakSet<ServerWebSocket<D>>();
  const releaseOnce = (ws: ServerWebSocket<D>): void => {
    if (released.has(ws)) return;
    released.add(ws);
    cap.release();
  };
  return {
    ...handlers,
    close: (ws) => {
      handlers.close(ws);
      releaseOnce(ws);
    },
    error: (ws, error) => {
      handlers.error?.(ws, error);
      releaseOnce(ws);
    },
  };
};

/**
 * Adapts the module-facing handler contract to Bun's argument order: Bun calls
 * `error(error, ws)`, while the hub receives `error(ws, error)`.
 */
export const toBunWebSocketHandler = <D>(handlers: WsEventHandlers<D>): WebSocketHandler<D> => {
  const bun: WebSocketHandler<D> = {
    open: handlers.open,
    message: handlers.message,
    pong: handlers.pong,
    close: handlers.close,
  };
  if (handlers.error !== undefined) {
    bun.error = (error, ws) => handlers.error?.(ws, error);
  }
  return bun;
};

export interface ServerDeps<R, D> {
  readonly runtime: ManagedRuntime<R, unknown>;
  readonly routes: ReadonlyArray<Route<R, unknown>>;
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
  const connectionCap = createConnectionCap(MAX_WS_CONNECTIONS);
  const ws: WsSetup<D> = {
    ...deps.ws,
    handlers: capWsHandlers(deps.ws.handlers, connectionCap),
  };
  const fetchHandler = createFetchHandler(
    (effect) => deps.runtime.runPromise(effect),
    deps.cors,
    ws,
    deps.mapError,
    handleRequest,
    connectionCap,
  );

  const serverProgram = Effect.gen(function* () {
    const PORT = yield* Config.Int("PORT").pipe(Config.withDefault(9006));

    yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve<D>({
          port: PORT,
          fetch: fetchHandler,
          websocket: toBunWebSocketHandler(ws.handlers),
          reusePort: true,
          // Kept in step with the handler heartbeat so the transport and the
          // application agree on when a peer is gone.
          idleTimeout: deps.ws.idleTimeoutSeconds,
          ...WS_SERVE_OPTIONS,
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
