import type { ServerWebSocket } from "bun";
import { Effect, Exit, Scope } from "effect";
import type { HttpError } from "../../platform/http/error-response";
import type { SocketConnection, WsEventHandlers } from "../../platform/http/ws";
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

interface Connection {
  // Owned by this handler: everything acquired while serving the socket is
  // registered on the scope and released exactly once, on close or on error.
  readonly scope: Scope.Closeable;
  missedPongs: number;
}

export const createWsEventHandlers = <D>(connection: SocketConnection<D>): WsEventHandlers<D> => {
  // Bun hands each callback the socket only, so connection lifetime cannot live
  // in an Effect context; the handler tracks it instead.
  const connections = new Map<Ws<D>, Connection>();

  const release = (ws: Ws<D>, reason: string): void => {
    const current = connections.get(ws);
    if (current === undefined) return;
    // Removing first picks a single winner between the close callback, a
    // callback error, and the heartbeat deadline.
    connections.delete(ws);

    const shutdown = connection
      .handleClose(ws)
      .pipe(Effect.ensuring(Scope.close(current.scope, Exit.void)));

    Effect.runPromise(Scope.provide(current.scope)(shutdown)).catch((err) => {
      console.error(`[WS ${reason} Finalizer Error]:`, err);
    });
  };

  const fail = (ws: Ws<D>, reason: string, err: unknown): void => {
    console.error(`[WS ${reason} Error]:`, err);
    release(ws, reason);
    if (ws.readyState === 1) ws.terminate();
  };

  const dispatch = (ws: Ws<D>, effect: Effect.Effect<void, HttpError>, reason: string): void => {
    const current = connections.get(ws);
    const program = current === undefined ? effect : Scope.provide(current.scope)(effect);
    // The socket callback cannot return an error, so a typed port failure is
    // logged and terminated here instead of escaping the handler.
    const handled = program.pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          fail(ws, reason, error);
        }),
      ),
    );
    Effect.runPromise(handled).catch((err) => {
      fail(ws, reason, err);
    });
  };

  const heartbeat = (ws: Ws<D>, current: Connection): Effect.Effect<void> =>
    Effect.gen(function* () {
      while (connections.get(ws) === current) {
        yield* Effect.sleep(WS_PING_INTERVAL_MS);
        if (connections.get(ws) !== current) return;
        if (current.missedPongs >= WS_MISSED_PONG_LIMIT) {
          // A peer that stopped answering pings may never emit `close`, so the
          // scope is finalized here rather than left to the transport.
          release(ws, "Heartbeat");
          if (ws.readyState === 1) ws.terminate();
          return;
        }
        if (ws.readyState !== 1) {
          release(ws, "Heartbeat");
          return;
        }
        current.missedPongs += 1;
        ws.ping();
      }
    });

  return {
    open(ws: Ws<D>) {
      const current: Connection = {
        scope: Scope.makeUnsafe("sequential"),
        missedPongs: 0,
      };
      connections.set(ws, current);
      Effect.runPromise(Effect.forkIn(heartbeat(ws, current), current.scope)).catch((err) => {
        fail(ws, "Heartbeat", err);
      });
      dispatch(ws, connection.handleOpen(ws), "Open");
    },
    message(ws: Ws<D>, message: string | Buffer) {
      dispatch(ws, connection.handleMessage(ws, message), "Message");
    },
    pong(ws: Ws<D>) {
      const current = connections.get(ws);
      if (current !== undefined) current.missedPongs = 0;
    },
    close(ws: Ws<D>) {
      release(ws, "Close");
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
