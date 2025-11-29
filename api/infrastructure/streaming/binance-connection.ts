/** Binance WebSocket Connection - Auto-reconnection with Effect and functional patterns */

import {
  Effect,
  Schedule,
  Duration,
  Ref,
  Queue,
  PubSub,
  Context,
  Layer,
  Scope,
  Option,
  Match,
  pipe,
} from "effect";
import WebSocket from "ws";
import type { BinanceKline } from "./types";
import { BinanceConnectionError } from "./types";
import { WS_CONFIG } from "../config/app.config";

// Service interface
export interface BinanceConnection {
  readonly pubSub: PubSub.PubSub<BinanceKline>;
  readonly subscribe: (symbol: string, interval?: string) => Effect.Effect<void>;
  readonly unsubscribe: (symbol: string, interval?: string) => Effect.Effect<void>;
}

export class BinanceConnectionTag extends Context.Tag("BinanceConnection")<
  BinanceConnectionTag,
  BinanceConnection
>() {}

// Parse kline message using Option
const parseKline = (data: string): Option.Option<BinanceKline> =>
  pipe(
    Effect.try(() => JSON.parse(data)),
    Effect.option,
    Effect.runSync,
    Option.flatMap((parsed) =>
      parsed.e === "kline"
        ? Option.some({
            symbol: parsed.s,
            interval: parsed.k.i,
            openTime: parsed.k.t,
            closeTime: parsed.k.T,
            open: parseFloat(parsed.k.o),
            high: parseFloat(parsed.k.h),
            low: parseFloat(parsed.k.l),
            close: parseFloat(parsed.k.c),
            volume: parseFloat(parsed.k.v),
            trades: parsed.k.n,
            isFinal: parsed.k.x,
          })
        : Option.none()
    )
  );

// WebSocket send helper
const wsSend = (ws: WebSocket, method: string, params: string[], symbol?: string) =>
  Effect.async<void, BinanceConnectionError>((resume) => {
    ws.send(JSON.stringify({ method, params, id: Date.now() }), (err: any) =>
      resume(
        err
          ? Effect.fail(new BinanceConnectionError({ message: err.message, symbol }))
          : Effect.void
      )
    );
  });

// Check if connection needs reconnect
const needsReconnect = (lastPong: number): boolean =>
  Date.now() - lastPong > WS_CONFIG.PONG_TIMEOUT_MS;

// Heartbeat action based on connection state
const heartbeatAction = Match.type<{
  ws: WebSocket | null;
  connected: boolean;
  lastPong: number;
}>().pipe(
  Match.when(
    ({ ws, connected }) => ws === null || !connected,
    () => Effect.void
  ),
  Match.when(
    ({ lastPong }) => needsReconnect(lastPong),
    ({ ws }) => Effect.sync(() => ws!.close())
  ),
  Match.orElse(({ ws }) => Effect.sync(() => ws!.ping()))
);

// Service implementation
export const BinanceConnectionLive = Layer.scoped(
  BinanceConnectionTag,
  Effect.gen(function* () {
    const scope = yield* Scope.Scope;
    const pubSub = yield* PubSub.unbounded<BinanceKline>();
    const messageQueue = yield* Queue.unbounded<BinanceKline>();
    const wsRef = yield* Ref.make<WebSocket | null>(null);
    const connectedRef = yield* Ref.make(false);
    const lastPongRef = yield* Ref.make(Date.now());

    // Connect to Binance
    const connect = Effect.async<WebSocket, BinanceConnectionError>((resume) => {
      const ws = new WebSocket(WS_CONFIG.BINANCE_URL);
      ws.on("open", () => resume(Effect.succeed(ws)));
      ws.on("error", (e: any) =>
        resume(Effect.fail(new BinanceConnectionError({ message: e.message })))
      );
    });

    // Setup handlers using functional approach
    const setupHandlers = (ws: WebSocket) =>
      Effect.sync(() => {
        ws.on("message", (data: Buffer) => {
          pipe(
            parseKline(data.toString()),
            Option.map((kline) => Effect.runFork(Queue.offer(messageQueue, kline)))
          );
        });
        ws.on("pong", () => Effect.runFork(Ref.set(lastPongRef, Date.now())));
        ws.on("close", () => Effect.runFork(Ref.set(connectedRef, false)));
        ws.on("error", (e) => Effect.runFork(Effect.logError(`WS error: ${e.message}`)));
      });

    // Heartbeat using functional pattern
    const heartbeat = Effect.gen(function* () {
      const ws = yield* Ref.get(wsRef);
      const connected = yield* Ref.get(connectedRef);
      const lastPong = yield* Ref.get(lastPongRef);
      yield* heartbeatAction({ ws, connected, lastPong });
    }).pipe(
      Effect.repeat(Schedule.fixed(Duration.millis(WS_CONFIG.PING_INTERVAL_MS))),
      Effect.catchAll(() => Effect.void)
    );

    // Connect with retry
    const connectWithRetry = connect.pipe(
      Effect.retry(
        Schedule.exponential(Duration.millis(WS_CONFIG.RECONNECT_DELAY_MS)).pipe(
          Schedule.compose(Schedule.recurs(WS_CONFIG.MAX_RECONNECT_ATTEMPTS))
        )
      ),
      Effect.tap((ws) => Ref.set(wsRef, ws)),
      Effect.tap((ws) => setupHandlers(ws)),
      Effect.tap(() => Ref.set(connectedRef, true)),
      Effect.tap(() => Effect.fork(heartbeat)),
      Effect.tap(() => Effect.logInfo("Binance WebSocket connected")),
      Effect.catchAll((e) => Effect.logError(`Failed to connect: ${e}`))
    );

    // Message dispatcher
    yield* Effect.forkIn(
      Stream.fromQueue(messageQueue).pipe(
        Stream.runForEach((kline) => PubSub.publish(pubSub, kline)),
        Effect.catchAll(() => Effect.void)
      ),
      scope
    );

    // Initial connection
    yield* connectWithRetry;

    // Cleanup on scope close
    yield* Scope.addFinalizer(
      scope,
      Effect.gen(function* () {
        const ws = yield* Ref.get(wsRef);
        pipe(
          Option.fromNullable(ws),
          Option.map((w) => w.close())
        );
        yield* Effect.logInfo("Binance connection closed");
      })
    );

    // Subscribe/unsubscribe using functional pattern
    const wsAction = (method: string, symbol: string, interval: string) =>
      Effect.gen(function* () {
        const ws = yield* Ref.get(wsRef);
        const connected = yield* Ref.get(connectedRef);
        yield* pipe(
          Option.fromNullable(ws),
          Option.filter(() => connected),
          Option.map((w) =>
            wsSend(w, method, [`${symbol.toLowerCase()}@kline_${interval}`], symbol)
          ),
          Option.getOrElse(() => Effect.void)
        );
      }).pipe(Effect.catchAll(() => Effect.void));

    return {
      pubSub,
      subscribe: (symbol: string, interval = "1m") => wsAction("SUBSCRIBE", symbol, interval),
      unsubscribe: (symbol: string, interval = "1m") => wsAction("UNSUBSCRIBE", symbol, interval),
    };
  })
);

// Import Stream for message dispatcher
import { Stream } from "effect";
