import type { Server, ServerWebSocket, WebSocketHandler } from "bun";
import { Config, Effect } from "effect";
import type { ManagedRuntime } from "effect/ManagedRuntime";
import type { CorsConfig } from "./cors";
import type { HttpError } from "./error-response";
import { createConnectionCap, createFetchHandler, type ConnectionCap } from "./fetch-handler";
import { createRouter } from "./router";
import type { Route } from "./route-contracts";
import type { WsEventHandlers, WsSetup } from "./ws";
import type { AlertsWsConnectionData, WsUpgradeServer } from "./ws/upgrade";

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

/** Runs socket setup work on the app runtime; services stay in the layer. */
export type RunAppEffect = <A, E>(effect: Effect.Effect<A, E>) => Promise<A>;

/** The alerts socket with its notifier and identity services already resolved. */
export interface AlertsWsMount {
  readonly path: string;
  readonly upgrade: (
    url: URL,
    req: Request,
    server: WsUpgradeServer<AlertsWsConnectionData>,
  ) => Promise<Response | undefined>;
  readonly handlers: WsEventHandlers<AlertsWsConnectionData>;
}

/** Deferred alerts wiring: the composition root binds it to the live runtime. */
interface AlertsWsSource {
  readonly path: string;
  readonly prepare: (run: RunAppEffect) => Promise<AlertsWsMount>;
}

/** The market setup plus any additional socket paths the same server serves. */
export interface WsSetupBundle<D> extends WsSetup<D> {
  readonly alerts?: AlertsWsSource;
}

export interface ServerDeps<R, D> {
  readonly runtime: ManagedRuntime<R, unknown>;
  readonly routes: ReadonlyArray<Route<R, unknown>>;
  readonly cors: CorsConfig;
  readonly ws: WsSetupBundle<D>;
  readonly mapError: (error: unknown) => HttpError;
}

const isAlertsData = (data: unknown): data is AlertsWsConnectionData =>
  typeof data === "object" &&
  data !== null &&
  (data as { readonly kind?: unknown }).kind === "alerts";

/**
 * One Bun socket handler serves every path, so the connection data decides
 * which per-path handler runs. Market data has no `kind`, hence the shape test.
 */
const combineWsHandlers = <D>(
  market: WsEventHandlers<D>,
  alerts: WsEventHandlers<AlertsWsConnectionData> | undefined,
): WsEventHandlers<D> => {
  if (alerts === undefined) return market;

  // Bun attaches the data the upgrade chose; only the socket type differs here.
  const asAlertsSocket = (ws: ServerWebSocket<D>): ServerWebSocket<AlertsWsConnectionData> =>
    ws as unknown as ServerWebSocket<AlertsWsConnectionData>;

  return {
    open: (ws) => {
      if (isAlertsData(ws.data)) alerts.open(asAlertsSocket(ws));
      else market.open(ws);
    },
    message: (ws, message) => {
      if (isAlertsData(ws.data)) alerts.message(asAlertsSocket(ws), message);
      else market.message(ws, message);
    },
    pong: (ws) => {
      if (isAlertsData(ws.data)) alerts.pong(asAlertsSocket(ws));
      else market.pong(ws);
    },
    close: (ws) => {
      if (isAlertsData(ws.data)) alerts.close(asAlertsSocket(ws));
      else market.close(ws);
    },
    error: (ws, error) => {
      if (isAlertsData(ws.data)) alerts.error?.(asAlertsSocket(ws), error);
      else market.error?.(ws, error);
    },
  };
};

/**
 * Routes the alerts path around the market-only fetch handler: subject lookup
 * is async, so this wrapper resolves it before handing the request to Bun's
 * upgrade. Market requests fall through untouched.
 */
const createAlertsFetchHandler = <D>(
  market: (req: Request, server: Server<D>) => Promise<Response | undefined>,
  alerts: AlertsWsMount | undefined,
  cors: CorsConfig,
  cap: ConnectionCap,
): ((req: Request, server: Server<D>) => Promise<Response | undefined>) => {
  if (alerts === undefined) return market;

  const reject = (status: number, error: string): Response =>
    new Response(JSON.stringify({ error, status }), {
      status,
      headers: cors.applyTo(new Headers({ "Content-Type": "application/json" })),
    });

  return async (req, server) => {
    const url = new URL(req.url);
    if (url.pathname !== alerts.path) return market(req, server);

    if (!cap.tryAcquire()) {
      return reject(503, "Too many WebSocket connections");
    }

    let response: Response | undefined;
    try {
      // Bun types one data shape per server; the alerts branch attaches its own.
      response = await alerts.upgrade(
        url,
        req,
        server as unknown as WsUpgradeServer<AlertsWsConnectionData>,
      );
    } catch (error) {
      cap.release();
      throw error;
    }

    if (response !== undefined) {
      cap.release();
      response = new Response(response.body, {
        status: response.status,
        headers: cors.applyTo(new Headers(response.headers)),
      });
    }

    return response;
  };
};

/**
 * Starts the Bun HTTP server. The app (routes + runtime) arrives as a
 * parameter so this transport layer never imports the composition root.
 */
export const serve = async <R, D>(deps: ServerDeps<R, D>, signal: AbortSignal): Promise<void> => {
  const handleRequest = createRouter(deps.routes);
  const connectionCap = createConnectionCap(MAX_WS_CONNECTIONS);
  const alerts =
    deps.ws.alerts === undefined
      ? undefined
      : await deps.ws.alerts.prepare((effect) => deps.runtime.runPromise(effect));

  const ws: WsSetup<D> = {
    path: deps.ws.path,
    idleTimeoutSeconds: deps.ws.idleTimeoutSeconds,
    upgrade: deps.ws.upgrade,
    handlers: capWsHandlers(combineWsHandlers(deps.ws.handlers, alerts?.handlers), connectionCap),
  };
  const fetchHandler = createAlertsFetchHandler(
    createFetchHandler(
      (effect) => deps.runtime.runPromise(effect),
      deps.cors,
      ws,
      deps.mapError,
      handleRequest,
      connectionCap,
    ),
    alerts,
    deps.cors,
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
