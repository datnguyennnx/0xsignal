/** WebSocket Server - Client connection handling with functional patterns */

import { Effect, Schedule, Duration, Scope, Match, Option, pipe, Array as Arr } from "effect";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { BinanceKline } from "./types";
import { SubscriptionManagerTag } from "./subscription-manager";
import { randomUUID } from "crypto";

interface ClientConnection {
  readonly id: string;
  readonly ws: WebSocket;
  symbol: string | null;
  readonly connectedAt: number;
  lastActivity: number;
}

interface ChartDataPoint {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

const toChartPoint = (kline: BinanceKline): ChartDataPoint => ({
  time: Math.floor(kline.closeTime / 1000),
  open: kline.open,
  high: kline.high,
  low: kline.low,
  close: kline.close,
  volume: kline.volume,
});

const CLIENT_TIMEOUT = 5 * 60 * 1000;

// Safe WebSocket send
const sendJson = (ws: WebSocket, data: unknown): Effect.Effect<void> =>
  Effect.sync(() => {
    pipe(
      Option.liftPredicate(ws, (w) => w.readyState === WebSocket.OPEN),
      Option.map((w) => w.send(JSON.stringify(data), () => {}))
    );
  });

// Message type classification
type MessageType =
  | { type: "subscribe"; symbol: string }
  | { type: "unsubscribe" }
  | { type: "ping" }
  | { type: "unknown" };

const classifyMessage = (msg: any): MessageType =>
  Match.value(msg).pipe(
    Match.when({ type: "subscribe", symbol: Match.string }, (m) => ({
      type: "subscribe" as const,
      symbol: m.symbol,
    })),
    Match.when({ type: "unsubscribe" }, () => ({ type: "unsubscribe" as const })),
    Match.when({ type: "ping" }, () => ({ type: "ping" as const })),
    Match.orElse(() => ({ type: "unknown" as const }))
  );

// Handle message based on type
const handleMessage = (
  msg: MessageType,
  client: ClientConnection,
  clientId: string,
  subscriptionManager: Effect.Effect.Success<typeof SubscriptionManagerTag>
): Effect.Effect<void> =>
  Match.value(msg).pipe(
    Match.when({ type: "subscribe" }, ({ symbol }) =>
      Effect.gen(function* () {
        const upperSymbol = symbol.toUpperCase();
        yield* pipe(
          Option.fromNullable(client.symbol),
          Option.map((s) => subscriptionManager.unsubscribe(s, clientId)),
          Option.getOrElse(() => Effect.void)
        );
        yield* subscriptionManager.subscribe(upperSymbol, clientId, (kline) => {
          Effect.runFork(
            sendJson(client.ws, { type: "data", symbol: upperSymbol, data: toChartPoint(kline) })
          );
        });
        client.symbol = upperSymbol;
        yield* sendJson(client.ws, {
          type: "subscribed",
          symbol: upperSymbol,
          timestamp: Date.now(),
        });
      })
    ),
    Match.when({ type: "unsubscribe" }, () =>
      pipe(
        Option.fromNullable(client.symbol),
        Option.map((s) =>
          Effect.gen(function* () {
            yield* subscriptionManager.unsubscribe(s, clientId);
            client.symbol = null;
            yield* sendJson(client.ws, { type: "unsubscribed", timestamp: Date.now() });
          })
        ),
        Option.getOrElse(() => Effect.void)
      )
    ),
    Match.when({ type: "ping" }, () =>
      sendJson(client.ws, { type: "pong", timestamp: Date.now() })
    ),
    Match.orElse(() => Effect.void)
  );

// Cleanup single client
const cleanupClient = (
  client: ClientConnection,
  clientId: string,
  subscriptionManager: Effect.Effect.Success<typeof SubscriptionManagerTag>,
  clients: Map<string, ClientConnection>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    client.ws.close();
    yield* pipe(
      Option.fromNullable(client.symbol),
      Option.map((s) => subscriptionManager.unsubscribe(s, clientId)),
      Option.getOrElse(() => Effect.void)
    );
    clients.delete(clientId);
  });

// Check if client is inactive
const isInactive = (client: ClientConnection, now: number): boolean =>
  now - client.lastActivity > CLIENT_TIMEOUT;

export const createWebSocketServer = (httpServer: Server) =>
  Effect.gen(function* () {
    const scope = yield* Scope.Scope;
    const subscriptionManager = yield* SubscriptionManagerTag;
    const wss = new WebSocketServer({ server: httpServer, path: "/ws/chart" });
    const clients = new Map<string, ClientConnection>();

    const handleConnection = (ws: WebSocket) =>
      Effect.gen(function* () {
        const clientId = randomUUID();
        const client: ClientConnection = {
          id: clientId,
          ws,
          symbol: null,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        };
        clients.set(clientId, client);

        ws.on("message", (data: Buffer) => {
          Effect.runFork(
            Effect.gen(function* () {
              const msg = JSON.parse(data.toString());
              client.lastActivity = Date.now();
              yield* handleMessage(classifyMessage(msg), client, clientId, subscriptionManager);
            }).pipe(Effect.catchAll(() => Effect.void))
          );
        });

        const handleDisconnect = pipe(
          Option.fromNullable(client.symbol),
          Option.map((s) => subscriptionManager.unsubscribe(s, clientId)),
          Option.getOrElse(() => Effect.void),
          Effect.tap(() => Effect.sync(() => clients.delete(clientId)))
        );

        ws.on("close", () => Effect.runFork(handleDisconnect));
        ws.on("error", () => Effect.runFork(handleDisconnect));
        yield* sendJson(ws, { type: "connected", clientId, timestamp: Date.now() });
      });

    // Cleanup inactive clients using functional approach
    yield* Effect.forkIn(
      Effect.gen(function* () {
        const now = Date.now();
        const inactiveClients = pipe(
          Array.from(clients.entries()),
          Arr.filter(([_, client]) => isInactive(client, now))
        );
        yield* Effect.forEach(
          inactiveClients,
          ([clientId, client]) => cleanupClient(client, clientId, subscriptionManager, clients),
          { concurrency: "unbounded" }
        );
      }).pipe(
        Effect.repeat(Schedule.fixed(Duration.minutes(1))),
        Effect.catchAll(() => Effect.void)
      ),
      scope
    );

    wss.on("connection", (ws) => Effect.runFork(handleConnection(ws)));

    // Cleanup on scope close
    yield* Scope.addFinalizer(
      scope,
      Effect.gen(function* () {
        yield* Effect.forEach(
          Array.from(clients.entries()),
          ([clientId, client]) => cleanupClient(client, clientId, subscriptionManager, clients),
          { concurrency: "unbounded" }
        );
        clients.clear();
        yield* subscriptionManager.cleanup();
        yield* Effect.async<void>((resume) => wss.close(() => resume(Effect.void)));
      })
    );

    return {
      wss,
      getConnectedClients: () => clients.size,
      getActiveSubscriptions: () => subscriptionManager.getActiveSubscriptions(),
    };
  });
