import { describe, expect, it } from "vitest";
import { Effect, Ref, Scope } from "effect";
import type { ServerWebSocket, WebSocketReadyState } from "bun";
import {
  SubscriptionClient,
  type ISubscription,
  type ISubscriptionTransport,
} from "@nktkas/hyperliquid";
import { asHttpError } from "../../../platform/http/error-response";
import { createWsEventHandlers, type Connection } from "../ws";
import type { SocketConnection } from "../../../platform/http/ws";
import type { RunSocketWork } from "../../../platform/http/ws";
import { MarketStreamHub, type MarketWsConnectionData } from "../stream";
import { makeMarketStreamHubLayer } from "../../../integrations/hyperliquid/streams/hub";
import type { Bucket } from "../../../integrations/hyperliquid/streams/hub-types";

type Data = { readonly id: string };

type HandlerSocket = ServerWebSocket<Data>;
type HubSocket = ServerWebSocket<MarketWsConnectionData>;
type SendArg = Parameters<HandlerSocket["send"]>[0];
type SendBinaryArg = Parameters<HandlerSocket["sendBinary"]>[0];
type SendStatus = ReturnType<HandlerSocket["send"]>;
type PingArg = Parameters<HandlerSocket["ping"]>[0];

class StubSocket<D> implements ServerWebSocket<D> {
  readonly subscriptions: string[] = [];
  readonly remoteAddress = "127.0.0.1";
  readonly readyState: WebSocketReadyState = 1;
  binaryType?: "nodebuffer" | "arraybuffer" | "uint8array" | "blob";
  terminated = false;
  pings = 0;
  private paused = false;

  constructor(readonly data: D) {}

  get isPaused(): boolean {
    return this.paused;
  }

  send(_data: SendArg, _compress?: boolean): SendStatus {
    return 0;
  }
  sendText(_data: string, _compress?: boolean): SendStatus {
    return 0;
  }
  sendBinary(_data: SendBinaryArg, _compress?: boolean): SendStatus {
    return 0;
  }
  close(_code?: number, _reason?: string): void {}
  terminate(): void {
    this.terminated = true;
  }
  ping(_data?: PingArg): SendStatus {
    this.pings += 1;
    return 0;
  }
  pong(_data?: PingArg): SendStatus {
    return 0;
  }
  publish(_topic: string, _data: SendArg, _compress?: boolean): SendStatus {
    return 0;
  }
  publishText(_topic: string, _data: string, _compress?: boolean): SendStatus {
    return 0;
  }
  publishBinary(_topic: string, _data: SendBinaryArg, _compress?: boolean): SendStatus {
    return 0;
  }
  subscribe(topic: string): boolean {
    if (this.subscriptions.includes(topic)) return false;
    this.subscriptions.push(topic);
    return true;
  }
  unsubscribe(topic: string): boolean {
    const index = this.subscriptions.indexOf(topic);
    if (index === -1) return false;
    this.subscriptions.splice(index, 1);
    return true;
  }
  isSubscribed(topic: string): boolean {
    return this.subscriptions.includes(topic);
  }
  cork<R = unknown>(_callback: (ws: ServerWebSocket<D>) => R): R {
    throw new Error("not implemented");
  }
  getBufferedAmount(): number {
    return 0;
  }
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }
}

type DeferredRunner = {
  readonly run: RunSocketWork;
  readonly queued: number;
  readonly flush: () => Promise<void>;
};

/** Collects socket work instead of running it, so a test can prove who owns the runtime. */
const makeDeferredRunner = (): DeferredRunner => {
  const pending: Effect.Effect<void, unknown>[] = [];
  const flush = async (): Promise<void> => {
    const effect = pending.shift();
    if (effect === undefined) return;
    await Effect.runPromise(effect);
    await flush();
  };
  return {
    get queued() {
      return pending.length;
    },
    run: (effect) => {
      pending.push(effect);
    },
    flush,
  };
};

type Recorder = {
  opened: number;
  closed: number;
  messages: number;
  readonly connection: SocketConnection<Data>;
};

const recorder = (failMessage: boolean): Recorder => {
  const state = { opened: 0, closed: 0, messages: 0 };
  return {
    get opened() {
      return state.opened;
    },
    get closed() {
      return state.closed;
    },
    get messages() {
      return state.messages;
    },
    connection: {
      handleOpen: () =>
        Effect.sync(() => {
          state.opened += 1;
        }),
      handleClose: () =>
        Effect.sync(() => {
          state.closed += 1;
        }),
      handleMessage: () =>
        failMessage
          ? Effect.fail(asHttpError(500, "handler failed"))
          : Effect.sync(() => {
              state.messages += 1;
            }),
    },
  };
};

describe("websocket event handlers", () => {
  it("defers socket work to the injected runner", async () => {
    const record = recorder(false);
    const runner = makeDeferredRunner();
    const handlers = createWsEventHandlers(record.connection, runner.run);
    const ws = new StubSocket({ id: "conn-1" });

    handlers.open(ws);

    // Starting a runtime inside the handler would run the work here.
    expect(record.opened).toBe(0);
    expect(runner.queued).toBe(2);

    await runner.flush();
    expect(record.opened).toBe(1);

    handlers.close(ws);
    await runner.flush();
    expect(record.closed).toBe(1);
  });

  it("releases the connection exactly once when a message handler fails", async () => {
    const record = recorder(true);
    const runner = makeDeferredRunner();
    const handlers = createWsEventHandlers(record.connection, runner.run);
    const ws = new StubSocket({ id: "conn-2" });

    handlers.open(ws);
    expect(runner.queued).toBe(2);
    await runner.flush();

    handlers.message(ws, "subscribe");
    await runner.flush();

    expect(record.closed).toBe(1);
    expect(ws.terminated).toBe(true);

    // A late close callback must not run the finalizer a second time.
    handlers.close(ws);
    await runner.flush();
    expect(record.closed).toBe(1);
  });

  it("interrupts in-flight message work when the connection closes", async () => {
    let interrupted = 0;
    let closed = 0;

    const connection: SocketConnection<Data> = {
      handleOpen: () => Effect.void,
      handleClose: () =>
        Effect.sync(() => {
          closed += 1;
        }),
      handleMessage: () =>
        Effect.never.pipe(
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              interrupted += 1;
            }),
          ),
        ),
    };
    const runner = makeDeferredRunner();
    const handlers = createWsEventHandlers(connection, runner.run);
    const ws = new StubSocket({ id: "conn-3" });

    handlers.open(ws);
    await runner.flush();

    handlers.message(ws, "subscribe");
    await runner.flush();
    // The handler is now a fiber in the connection scope, still in flight.
    expect(interrupted).toBe(0);
    expect(closed).toBe(0);

    handlers.close(ws);
    await runner.flush();

    // Closing the scope interrupts the handler before handleClose releases.
    expect(interrupted).toBe(1);
    expect(closed).toBe(1);
  });
});

const stubUpstream: ISubscription = { unsubscribe: () => Promise.resolve() };

const unusedTransport: ISubscriptionTransport = {
  subscribe: () => Promise.reject(new Error("unused transport")),
};

const stubProvider = {
  getCandleSnapshot: () => Effect.die("unused"),
  getAllMids: () => Effect.die("unused"),
  getAggregatedMarkets: () => Effect.succeed([]),
  getTicker: () => Effect.die("unused"),
  getOrderBook: () => Effect.die("unused"),
  getTradeAnnotation: () => Effect.die("unused"),
};

const makeAllMidsClient = (): SubscriptionClient =>
  Object.assign(new SubscriptionClient({ transport: unusedTransport }), {
    allMids: () => Promise.resolve(stubUpstream),
  });

describe("websocket event handler teardown", () => {
  it("leaves no bucket or connection behind across repeated cycles", async () => {
    const captured: { buckets: Ref.Ref<Map<string, Bucket>> | undefined } = {
      buckets: undefined,
    };
    const layer = makeMarketStreamHubLayer(stubProvider, {
      createClient: () => ({ subscriptionClient: makeAllMidsClient(), close: () => {} }),
      onAcquire: (buckets) => {
        captured.buckets = buckets;
      },
    });

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      if (captured.buckets === undefined) throw new Error("hub did not expose its buckets");
      const buckets = captured.buckets;

      const connections = new Map<HubSocket, Connection>();
      const runner = makeDeferredRunner();
      const toHttp = (error: { readonly message: string }) => asHttpError(500, error.message);
      const connection: SocketConnection<MarketWsConnectionData> = {
        handleOpen: (ws) => hub.handleOpen(ws).pipe(Effect.mapError(toHttp)),
        handleClose: (ws) => hub.handleClose(ws).pipe(Effect.mapError(toHttp)),
        handleMessage: (ws, raw) => hub.handleMessage(ws, raw).pipe(Effect.mapError(toHttp)),
      };
      const handlers = createWsEventHandlers(connection, runner.run, { connections });
      const flush = Effect.tryPromise({
        try: () => runner.flush(),
        catch: (error) => error,
      });

      const subscribeFrame = JSON.stringify({
        type: "subscribe",
        subscription: { channel: "allMids" },
      });

      for (let cycle = 0; cycle < 100; cycle++) {
        const ws = new StubSocket<MarketWsConnectionData>(hub.createConnectionData());

        handlers.open(ws);
        yield* flush;

        handlers.message(ws, subscribeFrame);
        yield* flush;
        expect(Ref.getUnsafe(buckets).size).toBe(1);
        expect(connections.size).toBe(1);

        handlers.close(ws);
        yield* flush;

        // Nothing may survive the reset, or a late handler could re-add it.
        expect(Ref.getUnsafe(buckets).size).toBe(0);
        expect(connections.size).toBe(0);

        // A callback that arrives after close must be a no-op, never a bucket.
        handlers.message(ws, subscribeFrame);
        yield* flush;
        expect(Ref.getUnsafe(buckets).size).toBe(0);
        expect(connections.size).toBe(0);
      }
    });

    await Effect.runPromise(Effect.provide(program, layer));
  });
});

describe("websocket event handler error teardown", () => {
  it("releases the registry entry, scope and buckets once when a socket errors", async () => {
    const captured: { buckets: Ref.Ref<Map<string, Bucket>> | undefined } = {
      buckets: undefined,
    };
    const layer = makeMarketStreamHubLayer(stubProvider, {
      createClient: () => ({ subscriptionClient: makeAllMidsClient(), close: () => {} }),
      onAcquire: (buckets) => {
        captured.buckets = buckets;
      },
    });

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      if (captured.buckets === undefined) throw new Error("hub did not expose its buckets");
      const buckets = captured.buckets;

      const connections = new Map<HubSocket, Connection>();
      const runner = makeDeferredRunner();
      const toHttp = (error: { readonly message: string }) => asHttpError(500, error.message);
      const connection: SocketConnection<MarketWsConnectionData> = {
        handleOpen: (ws) => hub.handleOpen(ws).pipe(Effect.mapError(toHttp)),
        handleClose: (ws) => hub.handleClose(ws).pipe(Effect.mapError(toHttp)),
        handleMessage: (ws, raw) => hub.handleMessage(ws, raw).pipe(Effect.mapError(toHttp)),
      };
      const handlers = createWsEventHandlers(connection, runner.run, { connections });
      const flush = Effect.tryPromise({
        try: () => runner.flush(),
        catch: (error) => error,
      });

      const ws = new StubSocket<MarketWsConnectionData>(hub.createConnectionData());
      handlers.open(ws);
      yield* flush;

      handlers.message(
        ws,
        JSON.stringify({ type: "subscribe", subscription: { channel: "allMids" } }),
      );
      yield* flush;
      expect(Ref.getUnsafe(buckets).size).toBe(1);
      expect(connections.size).toBe(1);

      const current = connections.get(ws);
      if (current === undefined) throw new Error("connection was not registered");
      let scopeFinalized = 0;
      yield* Scope.addFinalizer(
        current.scope,
        Effect.sync(() => {
          scopeFinalized += 1;
        }),
      );

      // An errored socket need not ever emit close: the error callback must
      // free the slot and the hub bucket on its own.
      handlers.error?.(ws, new Error("socket failed"));
      yield* flush;

      expect(current.closed).toBe(true);
      expect(connections.size).toBe(0);
      expect(Ref.getUnsafe(buckets).size).toBe(0);
      expect(scopeFinalized).toBe(1);
      expect(ws.terminated).toBe(true);

      // The close Bun may still deliver afterwards must be a complete no-op.
      handlers.close(ws);
      yield* flush;
      expect(connections.size).toBe(0);
      expect(Ref.getUnsafe(buckets).size).toBe(0);
      expect(scopeFinalized).toBe(1);
    });

    await Effect.runPromise(Effect.provide(program, layer));
  });
});
