/**
 * Binance Connection Manager
 * WebSocket connection with auto-reconnection using Effect-native logging
 */

import { Effect, Stream, Schedule, Duration, Ref, Queue, PubSub } from "effect";
import WebSocket from "ws";
import type { BinanceKline } from "./types";
import { BinanceConnectionError } from "./types";

// Binance WebSocket configuration
interface BinanceConfig {
  readonly url: string;
  readonly reconnectDelay: number;
  readonly maxReconnectAttempts: number;
  readonly pingInterval: number;
  readonly pongTimeout: number;
}

const defaultConfig: BinanceConfig = {
  url: "wss://stream.binance.com:9443/ws",
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
  pingInterval: 30000,
  pongTimeout: 10000,
};

// Connection state
interface ConnectionState {
  readonly ws: WebSocket | null;
  readonly isConnected: boolean;
  readonly reconnectAttempts: number;
  readonly subscribedSymbols: Set<string>;
}

// Binance Connection Service interface
export interface BinanceConnection {
  readonly subscribeToPubSub: () => Effect.Effect<PubSub.PubSub<BinanceKline>>;
  readonly subscribe: (symbol: string, interval?: string) => Effect.Effect<void>;
  readonly unsubscribe: (symbol: string, interval?: string) => Effect.Effect<void>;
  readonly getWebSocket: () => Effect.Effect<WebSocket | null>;
}

// Parse Binance kline message
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
      isFinal: k.x,
    };
  } catch {
    return null;
  }
};

// Create Binance WebSocket connection
export const createBinanceConnection = (
  config: BinanceConfig = defaultConfig
): Effect.Effect<BinanceConnection> =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<ConnectionState>({
      ws: null,
      isConnected: false,
      reconnectAttempts: 0,
      subscribedSymbols: new Set(),
    });

    const messageQueue = yield* Queue.unbounded<BinanceKline>();
    const lastPongRef = yield* Ref.make<number>(Date.now());

    // Create WebSocket connection
    const connect = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);
      if (state.ws) state.ws.close();

      return yield* Effect.async<WebSocket, BinanceConnectionError>((resume) => {
        Effect.runFork(Effect.logInfo(`Connecting to Binance: ${config.url}`));

        const ws = new WebSocket(config.url);

        ws.on("open", () => {
          Effect.runFork(Effect.logInfo("Binance WebSocket connected"));
          resume(Effect.succeed(ws));
        });

        ws.on("error", (error: any) => {
          resume(
            Effect.fail(
              new BinanceConnectionError({ message: `WebSocket error: ${error.message}` })
            )
          );
        });

        ws.on("close", () => {
          resume(
            Effect.fail(new BinanceConnectionError({ message: "WebSocket closed unexpectedly" }))
          );
        });
      });
    });

    // Setup WebSocket event handlers
    const setupHandlers = (ws: WebSocket) =>
      Effect.gen(function* () {
        ws.on("message", (data: Buffer) => {
          const kline = parseKlineMessage(data.toString());
          if (kline) {
            Effect.runFork(Queue.offer(messageQueue, kline));
          }
        });

        ws.on("pong", () => {
          Effect.runFork(Ref.set(lastPongRef, Date.now()));
        });

        ws.on("error", (error) => {
          Effect.runFork(Effect.logError(`Binance WS error: ${error.message}`));
        });

        ws.on("close", () => {
          Effect.runFork(Ref.update(stateRef, (s) => ({ ...s, ws: null, isConnected: false })));
        });

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          ws,
          isConnected: true,
          reconnectAttempts: 0,
        }));
      });

    // Heartbeat mechanism
    const heartbeat = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);
      const lastPong = yield* Ref.get(lastPongRef);
      const now = Date.now();

      if (state.ws && state.isConnected) {
        if (now - lastPong > config.pongTimeout) {
          state.ws.close();
          return yield* Effect.fail(new BinanceConnectionError({ message: "Heartbeat timeout" }));
        }
        state.ws.ping();
      }
    }).pipe(
      Effect.repeat(Schedule.fixed(Duration.millis(config.pingInterval))),
      Effect.catchAll(() => Effect.void)
    );

    // Connect with retry
    const connectWithRetry = connect.pipe(
      Effect.retry(
        Schedule.exponential(Duration.millis(config.reconnectDelay)).pipe(
          Schedule.compose(Schedule.recurs(config.maxReconnectAttempts))
        )
      ),
      Effect.tap(setupHandlers),
      Effect.tap(() => Effect.fork(heartbeat)),
      Effect.catchAll((error) => {
        Effect.runFork(Effect.logError(`Failed to connect to Binance: ${String(error)}`));
        return Effect.void;
      })
    );

    const pubSub = yield* PubSub.unbounded<BinanceKline>();
    const isInitialized = yield* Ref.make(false);

    // Lazy connection on first subscription
    const ensureConnected = Effect.gen(function* () {
      const initialized = yield* Ref.get(isInitialized);
      if (!initialized) {
        yield* Effect.logInfo("First subscription, connecting to Binance...");
        yield* connectWithRetry;
        yield* Ref.set(isInitialized, true);

        // Start broadcasting from queue to PubSub
        yield* Effect.forkDaemon(
          Stream.fromQueue(messageQueue).pipe(
            Stream.runForEach((kline) => PubSub.publish(pubSub, kline)),
            Effect.catchAll(() => Effect.void)
          )
        );
      }
    });

    return {
      subscribeToPubSub: () => Effect.succeed(pubSub),

      subscribe: (symbol: string, interval: string = "1m") =>
        Effect.gen(function* () {
          yield* ensureConnected;
          const state = yield* Ref.get(stateRef);

          if (state.ws && state.isConnected) {
            yield* subscribeSymbol(state.ws, symbol, interval).pipe(
              Effect.catchAll(() => Effect.void)
            );
            yield* Effect.logDebug(`Subscribed to Binance: ${symbol}@kline_${interval}`);
          } else {
            yield* Effect.logError("Cannot subscribe - WebSocket not connected");
          }
        }),

      unsubscribe: (symbol: string, interval: string = "1m") =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (state.ws && state.isConnected) {
            yield* unsubscribeSymbol(state.ws, symbol, interval).pipe(
              Effect.catchAll(() => Effect.void)
            );
            yield* Effect.logDebug(`Unsubscribed from Binance: ${symbol}@kline_${interval}`);
          }
        }),

      getWebSocket: () => Ref.get(stateRef).pipe(Effect.map((s) => s.ws)),
    };
  });

// Subscribe to symbol stream
export const subscribeSymbol = (
  ws: WebSocket,
  symbol: string,
  interval: string = "1m"
): Effect.Effect<void, BinanceConnectionError> =>
  Effect.async<void, BinanceConnectionError>((resume) => {
    ws.send(
      JSON.stringify({
        method: "SUBSCRIBE",
        params: [`${symbol.toLowerCase()}@kline_${interval}`],
        id: Date.now(),
      }),
      (error: any) => {
        if (error) {
          resume(
            Effect.fail(
              new BinanceConnectionError({ message: `Subscribe failed: ${error.message}`, symbol })
            )
          );
        } else {
          resume(Effect.void);
        }
      }
    );
  });

// Unsubscribe from symbol stream
export const unsubscribeSymbol = (
  ws: WebSocket,
  symbol: string,
  interval: string = "1m"
): Effect.Effect<void, BinanceConnectionError> =>
  Effect.async<void, BinanceConnectionError>((resume) => {
    ws.send(
      JSON.stringify({
        method: "UNSUBSCRIBE",
        params: [`${symbol.toLowerCase()}@kline_${interval}`],
        id: Date.now(),
      }),
      (error: any) => {
        if (error) {
          resume(
            Effect.fail(
              new BinanceConnectionError({
                message: `Unsubscribe failed: ${error.message}`,
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
