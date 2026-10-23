import type { ServerWebSocket } from "bun";
import { Effect, Exit, Scope } from "effect";
import type {
  MarketStreamHubPort,
  MarketWsConnectionData,
} from "../../../application/market-data/market-stream.contracts";

// The hub only answers client pings, so the server drives its own heartbeat.
// Two unanswered pings are the deadline after which the peer is half-open.
const WS_PING_INTERVAL_MS = 10_000;
const WS_MISSED_PONG_LIMIT = 2;
export const WS_IDLE_TIMEOUT_SECONDS = Math.ceil(
  (WS_PING_INTERVAL_MS * (WS_MISSED_PONG_LIMIT + 1)) / 1000,
);

type MarketWs = ServerWebSocket<MarketWsConnectionData>;

interface Connection {
  // Owned by this handler: everything acquired while serving the socket is
  // registered on the scope and released exactly once, on close or on error.
  readonly scope: Scope.Closeable;
  missedPongs: number;
}

export const createWsEventHandlers = (marketStreamHub: MarketStreamHubPort) => {
  // Bun hands each callback the socket only, so connection lifetime cannot live
  // in an Effect context; the handler tracks it instead.
  const connections = new Map<MarketWs, Connection>();

  const release = (ws: MarketWs, reason: string): void => {
    const connection = connections.get(ws);
    if (connection === undefined) return;
    // Removing first picks a single winner between the close callback, a
    // callback error, and the heartbeat deadline.
    connections.delete(ws);

    const shutdown = marketStreamHub
      .handleClose(ws)
      .pipe(Effect.ensuring(Scope.close(connection.scope, Exit.void)));

    Effect.runPromise(Scope.provide(connection.scope)(shutdown)).catch((err) => {
      console.error(`[WS ${reason} Finalizer Error]:`, err);
    });
  };

  const fail = (ws: MarketWs, reason: string, err: unknown): void => {
    console.error(`[WS ${reason} Error]:`, err);
    release(ws, reason);
    if (ws.readyState === 1) ws.terminate();
  };

  const dispatch = (ws: MarketWs, effect: Effect.Effect<void>, reason: string): void => {
    const connection = connections.get(ws);
    const program = connection === undefined ? effect : Scope.provide(connection.scope)(effect);
    Effect.runPromise(program).catch((err) => {
      fail(ws, reason, err);
    });
  };

  const heartbeat = (ws: MarketWs, connection: Connection): Effect.Effect<void> =>
    Effect.gen(function* () {
      while (connections.get(ws) === connection) {
        yield* Effect.sleep(WS_PING_INTERVAL_MS);
        if (connections.get(ws) !== connection) return;
        if (connection.missedPongs >= WS_MISSED_PONG_LIMIT) {
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
        connection.missedPongs += 1;
        ws.ping();
      }
    });

  return {
    open(ws: MarketWs) {
      const connection: Connection = {
        scope: Scope.makeUnsafe("sequential"),
        missedPongs: 0,
      };
      connections.set(ws, connection);
      Effect.runPromise(Effect.forkIn(heartbeat(ws, connection), connection.scope)).catch((err) => {
        fail(ws, "Heartbeat", err);
      });
      dispatch(ws, marketStreamHub.handleOpen(ws), "Open");
    },
    message(ws: MarketWs, message: string | Buffer) {
      dispatch(ws, marketStreamHub.handleMessage(ws, message), "Message");
    },
    pong(ws: MarketWs) {
      const connection = connections.get(ws);
      if (connection !== undefined) connection.missedPongs = 0;
    },
    close(ws: MarketWs) {
      release(ws, "Close");
    },
  };
};
