// ============================================================================
// BINANCE CONNECTION MANAGER - FUNCTIONAL APPROACH
// ============================================================================
// Manages single WebSocket connection to Binance with auto-reconnection
// Pure functional with Effect-TS
// ============================================================================

import { Effect, Stream, Schedule, Duration, Ref, Queue, PubSub } from "effect";
import WebSocket from "ws";
import type { BinanceKline } from "./types";
import { BinanceConnectionError } from "./types";
import { Logger } from "../logging/logger.service";

/**
 * Binance WebSocket configuration
 */
interface BinanceConfig {
  readonly url: string;
  readonly reconnectDelay: number; // milliseconds
  readonly maxReconnectAttempts: number;
  readonly pingInterval: number; // milliseconds
  readonly pongTimeout: number; // milliseconds
}

const defaultConfig: BinanceConfig = {
  url: "wss://stream.binance.com:9443/ws",
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
  pingInterval: 30000,
  pongTimeout: 10000,
};

/**
 * Connection state
 */
interface ConnectionState {
  readonly ws: WebSocket | null;
  readonly isConnected: boolean;
  readonly reconnectAttempts: number;
  readonly subscribedSymbols: Set<string>;
}

/**
 * Binance Connection Service
 */
export interface BinanceConnection {
  readonly subscribeToPubSub: () => Effect.Effect<PubSub.PubSub<BinanceKline>>;
  readonly subscribe: (symbol: string, interval?: string) => Effect.Effect<void>;
  readonly unsubscribe: (symbol: string, interval?: string) => Effect.Effect<void>;
  readonly getWebSocket: () => Effect.Effect<WebSocket | null>;
}

/**
 * Create Binance WebSocket connection with auto-reconnection
 * Returns connection service with stream and subscribe/unsubscribe methods
 */
export const createBinanceConnection = (
  config: BinanceConfig = defaultConfig
): Effect.Effect<BinanceConnection, never, Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger;
    // Mutable state managed by Effect.Ref
    const stateRef = yield* Ref.make<ConnectionState>({
      ws: null,
      isConnected: false,
      reconnectAttempts: 0,
      subscribedSymbols: new Set(),
    });

    // Queue for incoming messages
    const messageQueue = yield* Queue.unbounded<BinanceKline>();

    // Heartbeat tracking
    const lastPongRef = yield* Ref.make<number>(Date.now());

    /**
     * Pure function to parse Binance kline message
     */
    const parseKlineMessage = (data: string): BinanceKline | null => {
      try {
        const parsed = JSON.parse(data);
        if (!parsed.e || parsed.e !== "kline") return null;

        const k = parsed.k;
        return {
          symbol: parsed.s,
          interval: k.i,
          openTime: k.t,
          closeTime: k.T,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
          trades: k.n,
          isClosed: k.x,
        };
      } catch {
        return null;
      }
    };

    /**
     * Create WebSocket connection
     */
    const connect = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);

      // Close existing connection if any
      if (state.ws) {
        state.ws.close();
      }

      return yield* Effect.async<WebSocket, BinanceConnectionError>((resume) => {
        Effect.runFork(logger.info("Connecting to Binance", { url: config.url }));

        const ws = new WebSocket(config.url);

        ws.on("open", () => {
          Effect.runFork(logger.info("Binance WebSocket connected!"));
          resume(Effect.succeed(ws));
        });

        ws.on("error", (error: any) => {
          resume(
            Effect.fail(
              new BinanceConnectionError({
                message: `WebSocket error: ${error.message}`,
              })
            )
          );
        });

        ws.on("close", () => {
          resume(
            Effect.fail(
              new BinanceConnectionError({
                message: "WebSocket closed unexpectedly",
              })
            )
          );
        });
      });
    });

    /**
     * Setup WebSocket event handlers
     */
    const setupHandlers = (ws: WebSocket) =>
      Effect.gen(function* () {
        // Message handler
        ws.on("message", (data: Buffer) => {
          const message = data.toString();
          const kline = parseKlineMessage(message);
          if (kline) {
            Effect.runFork(logger.debug(`[STEP 1] Binance → Queue: ${kline.symbol}`));
            Effect.runFork(Queue.offer(messageQueue, kline));
          }
        });

        // Pong handler (heartbeat)
        ws.on("pong", () => {
          Effect.runFork(Ref.set(lastPongRef, Date.now()));
        });

        // Error handler
        ws.on("error", (error) => {
          Effect.runFork(logger.error("Binance WebSocket error", { error: error.message }));
        });

        // Close handler
        ws.on("close", () => {
          Effect.runFork(
            Ref.update(stateRef, (s) => ({
              ...s,
              ws: null,
              isConnected: false,
            }))
          );
        });

        // Update state
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          ws,
          isConnected: true,
          reconnectAttempts: 0,
        }));
      });

    /**
     * Heartbeat mechanism - ping every 30s, expect pong within 10s
     */
    const heartbeat = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);
      const lastPong = yield* Ref.get(lastPongRef);
      const now = Date.now();

      if (state.ws && state.isConnected) {
        // Check if pong timeout
        if (now - lastPong > config.pongTimeout) {
          // Connection is dead, close and reconnect
          state.ws.close();
          return yield* Effect.fail(
            new BinanceConnectionError({
              message: "Heartbeat timeout - connection dead",
            })
          );
        }

        // Send ping
        state.ws.ping();
      }
    }).pipe(
      Effect.repeat(Schedule.fixed(Duration.millis(config.pingInterval))),
      Effect.catchAll(() => Effect.void)
    );

    /**
     * Reconnection with exponential backoff
     */
    const connectWithRetry = connect.pipe(
      Effect.retry(
        Schedule.exponential(Duration.millis(config.reconnectDelay)).pipe(
          Schedule.compose(Schedule.recurs(config.maxReconnectAttempts))
        )
      ),
      Effect.tap(setupHandlers),
      Effect.tap(() => Effect.fork(heartbeat)),
      Effect.catchAll((error) => {
        Effect.runFork(
          logger.error("Failed to connect to Binance after retries", {
            error: String(error),
          })
        );
        return Effect.void;
      })
    );

    // Initial connection
    yield* connectWithRetry;

    // Create PubSub for broadcasting to multiple subscribers
    const pubSub = yield* PubSub.unbounded<BinanceKline>();

    // Start consuming queue and publishing to PubSub
    const broadcasterFiber = yield* Effect.forkDaemon(
      Stream.fromQueue(messageQueue).pipe(
        Stream.tap((kline) => logger.debug(`[STEP 2] Queue → Main PubSub: ${kline.symbol}`)),
        Stream.runForEach((kline) => PubSub.publish(pubSub, kline)),
        Effect.catchAll((error) => {
          Effect.runFork(logger.error("[ERROR] Broadcaster", { error: String(error) }));
          return Effect.void;
        })
      )
    );

    return {
      subscribeToPubSub: () => Effect.succeed(pubSub),
      subscribe: (symbol: string, interval: string = "1m") =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (state.ws && state.isConnected) {
            yield* subscribeSymbol(state.ws, symbol, interval).pipe(
              Effect.catchAll((error) => {
                Effect.runFork(
                  logger.error(`[ERROR] Failed to subscribe to ${symbol}`, {
                    error: String(error),
                  })
                );
                return Effect.void;
              })
            );
            yield* logger.info(`[STEP 0] Subscribed to Binance: ${symbol}@kline_${interval}`);
          } else {
            yield* logger.error("[ERROR] Cannot subscribe - WebSocket not connected!");
          }
        }),
      unsubscribe: (symbol: string, interval: string = "1m") =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (state.ws && state.isConnected) {
            yield* unsubscribeSymbol(state.ws, symbol, interval).pipe(
              Effect.catchAll((error) => {
                Effect.runFork(
                  logger.error(`Failed to unsubscribe from ${symbol}`, {
                    error: String(error),
                  })
                );
                return Effect.void;
              })
            );
            yield* logger.info(`Unsubscribed from Binance: ${symbol}@kline_${interval}`);
          }
        }),
      getWebSocket: () => Ref.get(stateRef).pipe(Effect.map((s) => s.ws)),
    };
  });

/**
 * Subscribe to symbol stream
 */
export const subscribeSymbol = (
  ws: WebSocket,
  symbol: string,
  interval: string = "1m"
): Effect.Effect<void, BinanceConnectionError> =>
  Effect.async<void, BinanceConnectionError>((resume) => {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;

    ws.send(
      JSON.stringify({
        method: "SUBSCRIBE",
        params: [stream],
        id: Date.now(),
      }),
      (error: any) => {
        if (error) {
          resume(
            Effect.fail(
              new BinanceConnectionError({
                message: `Failed to subscribe to ${symbol}: ${error.message}`,
                symbol,
              })
            )
          );
        } else {
          resume(Effect.void);
        }
      }
    );
  });

/**
 * Unsubscribe from symbol stream
 */
export const unsubscribeSymbol = (
  ws: WebSocket,
  symbol: string,
  interval: string = "1m"
): Effect.Effect<void, BinanceConnectionError> =>
  Effect.async<void, BinanceConnectionError>((resume) => {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;

    ws.send(
      JSON.stringify({
        method: "UNSUBSCRIBE",
        params: [stream],
        id: Date.now(),
      }),
      (error: any) => {
        if (error) {
          resume(
            Effect.fail(
              new BinanceConnectionError({
                message: `Failed to unsubscribe from ${symbol}: ${error.message}`,
                symbol,
              })
            )
          );
        } else {
          resume(Effect.void);
        }
      }
    );
  });
