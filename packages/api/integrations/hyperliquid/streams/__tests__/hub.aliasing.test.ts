import { describe, expect, it } from "vitest";
import { Effect, Fiber, Queue, Ref } from "effect";
import { TestClock } from "effect/testing";
import type { ServerWebSocket, ServerWebSocketSendStatus, WebSocketReadyState } from "bun";
import {
  SubscriptionClient,
  type ISubscription,
  type ISubscriptionTransport,
} from "@nktkas/hyperliquid";
import { makeMarketStreamHubLayer, MAX_SUBSCRIBE_ATTEMPTS, subscribeRetrySchedule } from "../hub";
import {
  applyDetach,
  type DetachRequest,
  enqueueDetach,
  MarketStreamHub,
  type Bucket,
  type MarketWsConnectionData,
} from "../hub-types";

const stubUpstream: ISubscription = { unsubscribe: () => Promise.resolve() };

const unusedTransport: ISubscriptionTransport = {
  subscribe: () => Promise.reject(new Error("unused transport")),
};

type AllMidsListener = (event: unknown) => void;

type Emitter = { listener: AllMidsListener | undefined };

const makeSubscriptionClient = (emitter?: Emitter): SubscriptionClient =>
  Object.assign(new SubscriptionClient({ transport: unusedTransport }), {
    allMids: (listener: AllMidsListener) => {
      if (emitter !== undefined) emitter.listener = listener;
      return Promise.resolve(stubUpstream);
    },
  });

const stubProvider = {
  getCandleSnapshot: () => Effect.die("unused"),
  getAllMids: () => Effect.die("unused"),
  getAggregatedMarkets: () => Effect.succeed([]),
  getTicker: () => Effect.die("unused"),
  getOrderBook: () => Effect.die("unused"),
  getTradeAnnotation: () => Effect.die("unused"),
};

class StubSocket implements ServerWebSocket<MarketWsConnectionData> {
  readonly subscriptions: string[] = [];
  readonly sent: string[] = [];
  readonly remoteAddress = "127.0.0.1";
  readonly readyState: WebSocketReadyState = 1;
  closed: { readonly code?: number; readonly reason?: string } | undefined;

  constructor(readonly data: MarketWsConnectionData) {}

  send(payload: string | Uint8Array): ServerWebSocketSendStatus {
    this.sent.push(typeof payload === "string" ? payload : new TextDecoder().decode(payload));
    return 0;
  }
  sendText(): ServerWebSocketSendStatus {
    return 0;
  }
  sendBinary(): ServerWebSocketSendStatus {
    return 0;
  }
  close(code?: number, reason?: string): void {
    this.closed = code === undefined ? {} : reason === undefined ? { code } : { code, reason };
  }
  terminate(): void {}
  ping(): ServerWebSocketSendStatus {
    return 0;
  }
  pong(): ServerWebSocketSendStatus {
    return 0;
  }
  publish(): ServerWebSocketSendStatus {
    return 0;
  }
  publishText(): ServerWebSocketSendStatus {
    return 0;
  }
  publishBinary(): ServerWebSocketSendStatus {
    return 0;
  }
  subscribe(): void {}
  unsubscribe(): void {}
  isSubscribed(): boolean {
    return false;
  }
  cork<T>(_callback: (ws: ServerWebSocket<T>) => T): T {
    throw new Error("not implemented");
  }
  getBufferedAmount(): number {
    return 0;
  }
}

const requireBuckets = (
  buckets: Ref.Ref<Map<string, Bucket>> | undefined,
): Ref.Ref<Map<string, Bucket>> => {
  if (buckets === undefined) throw new Error("hub did not expose its buckets");
  return buckets;
};

const requireBucket = (buckets: Ref.Ref<Map<string, Bucket>>, key: string): Bucket => {
  const bucket = Ref.getUnsafe(buckets).get(key);
  if (bucket === undefined) throw new Error(`bucket ${key} missing`);
  return bucket;
};

const awaitListener = (emitter: Emitter): Effect.Effect<AllMidsListener> =>
  Effect.gen(function* () {
    for (let i = 0; i < 100; i++) {
      const listener = emitter.listener;
      if (listener !== undefined) return listener;
      yield* Effect.yieldNow;
    }
    throw new Error("upstream listener was never registered");
  });

type Captured = { buckets: Ref.Ref<Map<string, Bucket>> | undefined };

const makeLayer = (captured: Captured) =>
  makeMarketStreamHubLayer(stubProvider, {
    createClient: () => ({ subscriptionClient: makeSubscriptionClient(), close: () => {} }),
    onAcquire: (buckets) => {
      captured.buckets = buckets;
    },
  });

const makeEmittingLayer = (captured: Captured, emitter: Emitter) =>
  makeMarketStreamHubLayer(stubProvider, {
    createClient: () => ({
      subscriptionClient: makeSubscriptionClient(emitter),
      close: () => {},
    }),
    onAcquire: (buckets) => {
      captured.buckets = buckets;
    },
  });

describe("market stream hub buckets aliasing", () => {
  it("keeps a previously read buckets map an independent snapshot", async () => {
    const captured: Captured = { buckets: undefined };

    const layer = makeLayer(captured);

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const buckets = requireBuckets(captured.buckets);

      const before = yield* Ref.get(buckets);
      const ws = new StubSocket(hub.createConnectionData({ channel: "allMids" }));

      yield* hub.handleOpen(ws);

      const after = yield* Ref.get(buckets);
      expect([...before.keys()]).toEqual([]);
      expect([...after.keys()]).toEqual(["allMids:"]);
    });

    await Effect.runPromise(program.pipe(Effect.provide(layer)));
  });

  it("keeps a bucket read before a join an independent snapshot of its clients", async () => {
    const captured: Captured = { buckets: undefined };

    const layer = makeLayer(captured);

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const buckets = requireBuckets(captured.buckets);

      const first = new StubSocket(hub.createConnectionData({ channel: "allMids" }));
      yield* hub.handleOpen(first);

      const snapshot = requireBucket(buckets, "allMids:");
      expect(snapshot.clients.size).toBe(1);

      const second = new StubSocket(hub.createConnectionData({ channel: "allMids" }));
      yield* hub.handleOpen(second);

      expect(requireBucket(buckets, "allMids:").clients.size).toBe(2);
      expect(snapshot.clients.size).toBe(1);
      expect(snapshot.clients.has(second)).toBe(false);
    });

    await Effect.runPromise(program.pipe(Effect.provide(layer)));
  });

  it("detaches one client without mutating the bucket snapshot", async () => {
    const captured: Captured = { buckets: undefined };

    const layer = makeLayer(captured);

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const buckets = requireBuckets(captured.buckets);

      const dropped = new StubSocket(hub.createConnectionData({ channel: "allMids" }));
      const kept = new StubSocket(hub.createConnectionData({ channel: "allMids" }));
      yield* hub.handleOpen(dropped);
      yield* hub.handleOpen(kept);

      const before = requireBucket(buckets, "allMids:");
      expect(before.clients.size).toBe(2);

      const requests = yield* Queue.unbounded<DetachRequest>();
      enqueueDetach(requests, "allMids:")(dropped);
      yield* applyDetach(buckets, yield* Queue.take(requests));

      const after = requireBucket(buckets, "allMids:");
      expect(after.clients.size).toBe(1);
      expect(after.clients.has(kept)).toBe(true);
      expect(after.clients.has(dropped)).toBe(false);
      expect(dropped.closed).toEqual({ code: 1013, reason: "client too slow" });
      expect(before.clients.size).toBe(2);
    });

    await Effect.runPromise(program.pipe(Effect.provide(layer)));
  });

  it("broadcasts a frame to a client that joined the bucket after the upstream subscribe", async () => {
    const captured: Captured = { buckets: undefined };
    const emitter: Emitter = { listener: undefined };

    const layer = makeEmittingLayer(captured, emitter);

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const buckets = requireBuckets(captured.buckets);

      const first = new StubSocket(hub.createConnectionData({ channel: "allMids" }));
      yield* hub.handleOpen(first);

      const listener = yield* awaitListener(emitter);

      // The join writes a NEW bucket object into the Ref; the emit path must
      // broadcast to the current bucket, not the one captured at subscribe time.
      const second = new StubSocket(hub.createConnectionData({ channel: "allMids" }));
      yield* hub.handleOpen(second);
      expect(requireBucket(buckets, "allMids:").clients.size).toBe(2);

      first.sent.length = 0;
      second.sent.length = 0;

      listener({ mids: { BTC: "100" } });

      expect(first.sent).toHaveLength(1);
      expect(second.sent).toHaveLength(1);
    });

    await Effect.runPromise(program.pipe(Effect.provide(layer)));
  });
});

describe("Market WS subscribe retries", () => {
  it("evaluates exactly MAX_SUBSCRIBE_ATTEMPTS times when the subscribe keeps failing", async () => {
    let attempts = 0;

    const program = Effect.gen(function* () {
      const fiber = yield* Effect.gen(function* () {
        attempts += 1;
        return yield* Effect.fail("subscribe failed");
      }).pipe(Effect.retry(subscribeRetrySchedule), Effect.exit, Effect.forkChild);

      yield* TestClock.adjust("1 hour");
      yield* Fiber.await(fiber);
    });

    await Effect.runPromise(Effect.provide(program, TestClock.layer()));

    // Retries plus the initial evaluation must equal the budget; a hardcoded
    // `upTo({ times: 3 })` allowed a fourth attempt.
    expect(attempts).toBe(MAX_SUBSCRIBE_ATTEMPTS);
  });
});
