import type { ServerWebSocket } from "bun";
import { Effect, Exit, Scope } from "effect";
import type { HttpError } from "../../platform/http/error-response";
import type { RunSocketWork, SocketConnection, WsEventHandlers } from "../../platform/http/ws";
import { handleWsUpgrade, type WsUpgradeServer } from "../../platform/http/ws/upgrade";
import type { MarketStreamHubPort, MarketWsConnectionData, MarketWsSubscription } from "./stream";
import { parseMarketWsSubscription } from "./subscription-parser";

// The hub only answers client pings, so the server drives its own heartbeat.
// Two unanswered pings are the deadline after which the peer is half-open.
const WS_PING_INTERVAL_MS = 10_000;
const WS_MISSED_PONG_LIMIT = 2;
export const WS_IDLE_TIMEOUT_SECONDS = Math.ceil(
  (WS_PING_INTERVAL_MS * (WS_MISSED_PONG_LIMIT + 1)) / 1000,
);

type Ws<D> = ServerWebSocket<D>;

export interface Connection {
  // Owned by this handler: everything acquired while serving the socket is
  // registered on the scope and released exactly once, on close or on error.
  // Handler work is forked into it so closing the scope interrupts in-flight
  // work instead of letting it resume after the hub state was released.
  readonly scope: Scope.Closeable;
  missedPongs: number;
  // Set before the registry entry is removed. Every socket callback re-checks
  // it, so a late callback can never mutate the hub for a dead connection.
  closed: boolean;
}

export type WsHandlerOptions<D> = {
  /** Test seam: inspect the registry, which is otherwise private to the handlers. */
  readonly connections?: Map<Ws<D>, Connection>;
};

type HandlerContext<D> = {
  readonly connection: SocketConnection<D>;
  readonly run: RunSocketWork;
  readonly connections: Map<Ws<D>, Connection>;
};

const closeConnection = <D>(
  { connections, run, connection }: HandlerContext<D>,
  ws: Ws<D>,
  reason: string,
): void => {
  const current = connections.get(ws);
  if (current === undefined) return;
  // Mark and remove first: this picks a single winner between the close
  // callback, a callback error, and the heartbeat deadline, and makes every
  // later callback for this socket a no-op.
  current.closed = true;
  connections.delete(ws);

  // Close the scope before releasing hub state: finalizers interrupt in-flight
  // handler fibers, so none of them can resume and re-add the dead client after
  // `handleClose` removed it.
  const shutdown = Scope.close(current.scope, Exit.void).pipe(
    Effect.andThen(connection.handleClose(ws)),
  );

  run(shutdown, (err) => {
    console.error(`[WS ${reason} Finalizer Error]:`, err);
  });
};

const failConnection = <D>(
  context: HandlerContext<D>,
  ws: Ws<D>,
  reason: string,
  err: unknown,
): void => {
  console.error(`[WS ${reason} Error]:`, err);
  closeConnection(context, ws, reason);
  if (ws.readyState === 1) ws.terminate();
};

const dispatch = <D>(
  context: HandlerContext<D>,
  ws: Ws<D>,
  effect: Effect.Effect<void, HttpError>,
  reason: string,
): void => {
  const current = context.connections.get(ws);
  if (current === undefined || current.closed) return;

  // Forking into the connection scope (starting immediately, so ordering with
  // the socket callback is preserved) lets close interrupt the work. Without
  // the fork the effect would run at the runtime root, where Scope.close
  // cannot reach it.
  const program = Effect.suspend(() => (current.closed ? Effect.void : effect)).pipe(
    // The socket callback cannot return an error, so a typed port failure is
    // logged and terminated here instead of escaping the handler.
    Effect.catch((error) =>
      Effect.sync(() => {
        failConnection(context, ws, reason, error);
      }),
    ),
    Effect.forkIn(current.scope, { startImmediately: true }),
    Effect.asVoid,
  );
  context.run(program, (err) => {
    failConnection(context, ws, reason, err);
  });
};

const heartbeatLoop = <D>(
  context: HandlerContext<D>,
  ws: Ws<D>,
  current: Connection,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    while (context.connections.get(ws) === current) {
      yield* Effect.sleep(WS_PING_INTERVAL_MS);
      if (context.connections.get(ws) !== current) return;
      if (current.missedPongs >= WS_MISSED_PONG_LIMIT) {
        // A peer that stopped answering pings may never emit `close`, so the
        // scope is finalized here rather than left to the transport.
        closeConnection(context, ws, "Heartbeat");
        if (ws.readyState === 1) ws.terminate();
        return;
      }
      if (ws.readyState !== 1) {
        closeConnection(context, ws, "Heartbeat");
        return;
      }
      current.missedPongs += 1;
      ws.ping();
    }
  });

const registerConnection = <D>(context: HandlerContext<D>, ws: Ws<D>): void => {
  // A duplicate open must not replace a live (or already closed) registration.
  if (context.connections.has(ws)) return;
  const current: Connection = {
    scope: Scope.makeUnsafe("sequential"),
    missedPongs: 0,
    closed: false,
  };
  context.connections.set(ws, current);
  context.run(
    heartbeatLoop(context, ws, current).pipe(Effect.forkIn(current.scope), Effect.asVoid),
    (err) => {
      failConnection(context, ws, "Heartbeat", err);
    },
  );
  dispatch(context, ws, context.connection.handleOpen(ws), "Open");
};

const resolveConnection = <D>(
  connections: Map<Ws<D>, Connection>,
  ws: Ws<D>,
): Connection | undefined => connections.get(ws);

export const createWsEventHandlers = <D>(
  connection: SocketConnection<D>,
  run: RunSocketWork,
  options: WsHandlerOptions<D> = {},
): WsEventHandlers<D> => {
  // The registry is mutated only from Bun socket callbacks and the
  // per-connection heartbeat, both on the single JS thread.
  const context: HandlerContext<D> = {
    connection,
    run,
    connections: options.connections ?? new Map<Ws<D>, Connection>(),
  };

  return {
    open(ws: Ws<D>) {
      registerConnection(context, ws);
    },
    message(ws: Ws<D>, message: string | Buffer) {
      dispatch(context, ws, connection.handleMessage(ws, message), "Message");
    },
    pong(ws: Ws<D>) {
      const current = resolveConnection(context.connections, ws);
      if (current !== undefined) current.missedPongs = 0;
    },
    error(ws: Ws<D>, error: unknown) {
      // An errored socket may never emit `close`, so the registry entry, scope
      // and hub buckets are released here; a later close callback is a no-op.
      failConnection(context, ws, "Socket", error);
    },
    close(ws: Ws<D>) {
      closeConnection(context, ws, "Close");
    },
  };
};

export const MARKET_WS_PATH = "/api/ws/market";

/**
 * Binds the generic transport upgrade to the market-data channel grammar, so
 * `platform/` never names a module and the composition root only supplies the
 * hub.
 */
export const upgradeMarketWs = (
  url: URL,
  req: Request,
  server: WsUpgradeServer<MarketWsConnectionData>,
  hub: MarketStreamHubPort,
): Response | undefined =>
  handleWsUpgrade<MarketWsSubscription, MarketWsConnectionData>(url, req, server, {
    path: MARKET_WS_PATH,
    parseChannel: parseMarketWsSubscription,
    createConnectionData: (subscription) => hub.createConnectionData(subscription),
  });
