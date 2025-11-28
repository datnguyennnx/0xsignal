/**
 * WebSocket Server
 * Handles client connections with Effect-native logging
 */

import { Effect, Schedule, Duration } from "effect";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { ChartDataPoint, BinanceKline } from "./types";
import { SubscriptionManagerTag } from "./subscription-manager";
import { randomUUID } from "crypto";

interface ClientConnection {
  readonly id: string;
  readonly ws: WebSocket;
  readonly symbol: string | null;
  readonly connectedAt: number;
  readonly lastActivity: number;
}

// Transform Binance kline to chart data point
const toChartDataPoint = (kline: BinanceKline): ChartDataPoint => ({
  time: Math.floor(kline.closeTime / 1000),
  open: kline.open,
  high: kline.high,
  low: kline.low,
  close: kline.close,
  volume: kline.volume,
});

export const createWebSocketServer = (httpServer: Server) =>
  Effect.gen(function* () {
    const subscriptionManager = yield* SubscriptionManagerTag;
    const wss = new WebSocketServer({ server: httpServer, path: "/ws/chart" });
    const clients = new Map<string, ClientConnection>();
    const CLIENT_TIMEOUT = 5 * 60 * 1000;

    const handleConnection = (ws: WebSocket) =>
      Effect.gen(function* () {
        const clientId = randomUUID();
        const shortId = clientId.substring(0, 8);
        let currentSymbol: string | null = null;

        const client: ClientConnection = {
          id: clientId,
          ws,
          symbol: null,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        };

        clients.set(clientId, client);

        const sendToClient = (data: any): void => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data), () => {});
          }
        };

        ws.on("message", (data: Buffer) => {
          Effect.runFork(
            Effect.gen(function* () {
              try {
                const message = JSON.parse(data.toString());
                (client as any).lastActivity = Date.now();

                if (message.type === "subscribe" && message.symbol) {
                  const symbol = message.symbol.toUpperCase();

                  if (currentSymbol) {
                    yield* subscriptionManager.unsubscribe(currentSymbol, clientId);
                  }

                  const callback = (kline: BinanceKline) => {
                    sendToClient({ type: "data", symbol, data: toChartDataPoint(kline) });
                  };

                  yield* subscriptionManager.subscribe(symbol, clientId, callback);
                  currentSymbol = symbol;
                  (client as any).symbol = symbol;

                  yield* Effect.logDebug(`[WS] Client ${shortId} subscribed to ${symbol}`);
                  sendToClient({ type: "subscribed", symbol, timestamp: Date.now() });
                } else if (message.type === "unsubscribe") {
                  if (currentSymbol) {
                    yield* subscriptionManager.unsubscribe(currentSymbol, clientId);
                    yield* Effect.logDebug(
                      `[WS] Client ${shortId} unsubscribed from ${currentSymbol}`
                    );
                    currentSymbol = null;
                    (client as any).symbol = null;
                    sendToClient({ type: "unsubscribed", timestamp: Date.now() });
                  }
                } else if (message.type === "ping") {
                  sendToClient({ type: "pong", timestamp: Date.now() });
                }
              } catch {
                // Ignore parse errors
              }
            })
          );
        });

        const handleDisconnect = Effect.gen(function* () {
          if (currentSymbol) {
            yield* subscriptionManager.unsubscribe(currentSymbol, clientId);
          }
          clients.delete(clientId);
          yield* Effect.logDebug(`[WS] Client ${shortId} disconnected`);
        });

        ws.on("close", () => Effect.runFork(handleDisconnect));
        ws.on("error", () => Effect.runFork(handleDisconnect));

        sendToClient({ type: "connected", clientId, timestamp: Date.now() });
        yield* Effect.logDebug(`[WS] Client ${shortId} connected`);
      });

    // Cleanup inactive clients periodically
    const cleanupInactiveClients = Effect.gen(function* () {
      const now = Date.now();
      for (const [clientId, client] of clients.entries()) {
        if (now - client.lastActivity > CLIENT_TIMEOUT) {
          client.ws.close();
          if (client.symbol) {
            yield* subscriptionManager.unsubscribe(client.symbol, clientId);
          }
          clients.delete(clientId);
        }
      }
    }).pipe(
      Effect.repeat(Schedule.fixed(Duration.minutes(1))),
      Effect.catchAll(() => Effect.void)
    );

    yield* Effect.fork(cleanupInactiveClients);

    wss.on("connection", (ws) => {
      Effect.runFork(handleConnection(ws));
    });

    const shutdown = Effect.gen(function* () {
      for (const [clientId, client] of clients.entries()) {
        client.ws.close();
        if (client.symbol) {
          yield* subscriptionManager.unsubscribe(client.symbol, clientId);
        }
      }
      clients.clear();
      yield* subscriptionManager.cleanup();
      yield* Effect.async<void>((resume) => {
        wss.close(() => resume(Effect.void));
      });
    });

    return {
      wss,
      shutdown,
      getConnectedClients: () => clients.size,
      getActiveSubscriptions: () => subscriptionManager.getActiveSubscriptions(),
    };
  });
