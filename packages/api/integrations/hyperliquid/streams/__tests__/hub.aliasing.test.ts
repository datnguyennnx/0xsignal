import { describe, expect, it } from "vitest";
import { Effect, Exit, Fiber, Option, Queue, Ref, Scope } from "effect";
import { TestClock } from "effect/testing";
import type { ServerWebSocket, WebSocketReadyState } from "bun";
import { TransportError } from "@0xsignal/sdk-hyperliquid";
import type {
  SubscribeOptions,
  Subscription,
  SubscriptionHandle,
  WsClient,
} from "@0xsignal/sdk-hyperliquid/subscription";
import {
  makeMarketStreamHubLayer,
  MAX_BUCKETS,
  MAX_CLIENTS_PER_BUCKET,
  MAX_SUBSCRIBE_ATTEMPTS,
  subscribeRetrySchedule,
} from "../hub";
import {
  applyDetach,
  type DetachRequest,
  enqueueDetach,
  joinBucket,
  MarketStreamHub,
  type Bucket,
  BucketJoinError,
  type MarketWsConnectionData,
  WebSocketSubscribeError,
} from "../hub-types";
import { subscribeUpstream } from "../hub-subscription";
import type { HyperliquidAggregatedAsset } from "../../data-sources/types";

const makeHandle = (subscription: Subscription): SubscriptionHandle => ({
  subscription,
  unsubscribe: () => {},
  unsubscribeAsync: () => Promise.resolve(),
});

type SubscribeFn = (
  subscription: Subscription,
  onData: (data: unknown) => void,
  options?: SubscribeOptions,
) => SubscriptionHandle;

const makeWsClient = (subscribe: SubscribeFn): WsClient => ({ subscribe }) as unknown as WsClient;

type SubscriptionCapture = { readonly subscriptions: Subscription[] };

const makeCaptureClient = (capture: SubscriptionCapture): WsClient =>
  makeWsClient((subscription) => {
    capture.subscriptions.push(subscription);
    return makeHandle(subscription);
  });

const makeCandleBucket = (symbol: string): Bucket => ({
  key: `candle:${symbol}:1m`,
  subscription: { channel: "candle", symbol, interval: "1m" },
  clients: new Set(),
  upstream: Option.none(),
  state: { _tag: "idle" },
  lastSnapshot: { current: Option.none() },
  retryCount: 0,
  subscribeFiber: Option.none(),
  scope: Scope.makeUnsafe("sequential"),
});

const resolveUpstream = (symbol: string): Effect.Effect<Subscription[], WebSocketSubscribeError> =>
  Effect.gen(function* () {
    const capture: SubscriptionCapture = { subscriptions: [] };
    const bucket = makeCandleBucket(symbol);
    yield* subscribeUpstream(
      bucket,
      makeCaptureClient(capture),
      Promise.resolve([makeSpotAsset()]),
      () => {},
      () => bucket,
    );
    return capture.subscriptions;
  });

type AllMidsListener = (event: unknown) => void;

type Emitter = { listener: AllMidsListener | undefined };

const makeSubscriptionClient = (emitter?: Emitter): WsClient =>
  makeWsClient((subscription, onData) => {
    if (subscription.type === "allMids" && emitter !== undefined) {
      emitter.listener = onData as AllMidsListener;
    }
    return makeHandle(subscription);
  });

const makePerpAsset = (rawCoin: string) => ({
  coin: rawCoin,
  rawCoin,
  displaySymbol: rawCoin,
  dexPrefix: null,
  isHip3: false,
  quoteCurrency: "USD",
  name: rawCoin,
  category: "perp",
  displayCategory: "Perp",
  isDelisted: false,
  dex: "HYPERLIQUID" as const,
  assetId: 0,
  marketType: "perp" as const,
  markPx: "100",
  prevDayPx: "100",
  openInterest: "0",
  funding: "0",
  dayNtlVlm: "0",
  maxLeverage: 50,
  szDecimals: 2,
});

const makeSpotAsset = (): HyperliquidAggregatedAsset => ({
  coin: "DBL",
  rawCoin: "DBL/USDC",
  displaySymbol: "DBL/USDC",
  dexPrefix: null,
  isHip3: false,
  quoteCurrency: "USDC",
  name: "@203",
  category: "spot",
  displayCategory: "Spot",
  isDelisted: false,
  dex: "HYPERLIQUID" as const,
  assetId: 203,
  marketType: "spot" as const,
  markPx: "1",
  prevDayPx: "1",
  openInterest: "0" as const,
  funding: "0" as const,
  dayNtlVlm: "0",
  maxLeverage: 1 as const,
  szDecimals: 2,
  dayBaseVlm: "0",
});

const stubProvider = {
  getCandleSnapshot: () => Effect.die("unused"),
  getAllMids: () => Effect.die("unused"),
  getAggregatedMarkets: () => Effect.succeed([makePerpAsset("BTC"), makePerpAsset("ETH")]),
  getTicker: () => Effect.die("unused"),
  getOrderBook: () => Effect.die("unused"),
  getTradeAnnotation: () => Effect.die("unused"),
};

type HubSocket = ServerWebSocket<MarketWsConnectionData>;
type SendArg = Parameters<HubSocket["send"]>[0];
type SendBinaryArg = Parameters<HubSocket["sendBinary"]>[0];
type SendStatus = ReturnType<HubSocket["send"]>;
type PingArg = Parameters<HubSocket["ping"]>[0];

class StubSocket implements ServerWebSocket<MarketWsConnectionData> {
  readonly subscriptions: string[] = [];
  readonly sent: string[] = [];
  readonly remoteAddress = "127.0.0.1";
  readonly readyState: WebSocketReadyState = 1;
  binaryType?: "nodebuffer" | "arraybuffer" | "uint8array" | "blob";
  closed: { readonly code?: number; readonly reason?: string } | undefined;
  private paused = false;

  constructor(
    readonly data: MarketWsConnectionData,
    private readonly buffered = 0,
  ) {}

  get isPaused(): boolean {
    return this.paused;
  }

  send(data: SendArg, _compress?: boolean): SendStatus {
    this.sent.push(
      typeof data === "string"
        ? data
        : data instanceof Blob
          ? "[blob]"
          : new TextDecoder().decode(data),
    );
    return 1;
  }
  sendText(data: string, _compress?: boolean): SendStatus {
    return this.send(data);
  }
  sendBinary(data: SendBinaryArg, _compress?: boolean): SendStatus {
    return this.send(data);
  }
  close(code?: number, reason?: string): void {
    this.closed = code === undefined ? {} : reason === undefined ? { code } : { code, reason };
  }
  terminate(): void {}
  ping(_data?: PingArg): SendStatus {
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
  cork<R = unknown>(_callback: (ws: ServerWebSocket<MarketWsConnectionData>) => R): R {
    throw new Error("not implemented");
  }
  getBufferedAmount(): number {
    return this.buffered;
  }
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
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

const connectionData = (id: string): MarketWsConnectionData => ({
  id,
  subscriptions: Ref.makeUnsafe(new Map()),
});

const sentFrames = (ws: StubSocket): Record<string, unknown>[] =>
  ws.sent.map((frame) => JSON.parse(frame) as Record<string, unknown>);

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
    createClient: () => ({ wsClient: makeSubscriptionClient(), close: () => {} }),
    onAcquire: (buckets) => {
      captured.buckets = buckets;
    },
  });

const makeEmittingLayer = (captured: Captured, emitter: Emitter) =>
  makeMarketStreamHubLayer(stubProvider, {
    createClient: () => ({
      wsClient: makeSubscriptionClient(emitter),
      close: () => {},
    }),
    onAcquire: (buckets) => {
      captured.buckets = buckets;
    },
  });

type ErrorEmitter = {
  onError: ((error: unknown) => void) | undefined;
  subscribeCalls: number;
};

/** allMids stub that captures the SDK error callback on each subscribe. */
const makeErrorSubscriptionClient = (emitter: ErrorEmitter): WsClient =>
  makeWsClient((subscription, _onData, options) => {
    emitter.subscribeCalls += 1;
    emitter.onError = options?.onError;
    return makeHandle(subscription);
  });

const makeErrorLayer = (captured: Captured, emitter: ErrorEmitter) =>
  makeMarketStreamHubLayer(stubProvider, {
    createClient: () => ({
      wsClient: makeErrorSubscriptionClient(emitter),
      close: () => {},
    }),
    onAcquire: (buckets) => {
      captured.buckets = buckets;
    },
  });

const awaitSubscribed = (emitter: ErrorEmitter): Effect.Effect<void> =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (emitter.subscribeCalls > 0 && emitter.onError !== undefined) return;
      yield* Effect.yieldNow;
    }
    throw new Error("upstream error callback was never registered");
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

describe("Market WS restart queue lifetime", () => {
  it("keeps restarting a shared bucket after the first client's scope closes", async () => {
    const captured: Captured = { buckets: undefined };
    const emitter: ErrorEmitter = { onError: undefined, subscribeCalls: 0 };
    const layer = makeErrorLayer(captured, emitter);

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const buckets = requireBuckets(captured.buckets);

      const first = new StubSocket(hub.createConnectionData({ channel: "allMids" }));
      const second = new StubSocket(hub.createConnectionData({ channel: "allMids" }));

      // The real handler serves each connection from its own scope. Serve the
      // first client that way, then close it while the bucket is still shared.
      const firstScope = Scope.makeUnsafe("sequential");
      yield* Scope.provide(firstScope)(hub.handleOpen(first));
      yield* hub.handleOpen(second);
      yield* awaitSubscribed(emitter);
      expect(emitter.subscribeCalls).toBe(1);
      expect(requireBucket(buckets, "allMids:").clients.size).toBe(2);

      // Same order as the socket handler: interrupt the connection's work,
      // then release its hub state.
      yield* Scope.close(firstScope, Exit.void);
      yield* hub.handleClose(first);
      expect(requireBucket(buckets, "allMids:").clients.size).toBe(1);

      second.sent.length = 0;
      const onError = emitter.onError;
      if (onError === undefined) throw new Error("upstream error callback was not registered");
      onError(new TransportError(new Error("upstream dropped")));

      // The restart queue and its drain own the bucket's lifetime, so the
      // remaining client still gets the restart.
      yield* TestClock.adjust("2 seconds");
      for (let step = 0; step < 50 && emitter.subscribeCalls < 2; step++) {
        yield* Effect.yieldNow;
      }

      expect(emitter.subscribeCalls).toBe(2);
      const reconnecting = second.sent
        .map((frame) => JSON.parse(frame) as { readonly type?: string })
        .filter((frame) => frame.type === "reconnecting");
      expect(reconnecting).toHaveLength(1);
    });

    await Effect.runPromise(Effect.provide(program.pipe(Effect.provide(layer)), TestClock.layer()));
  });
});

describe("Market WS detach queue overflow", () => {
  it("drops and closes a client on overflow instead of stranding it", async () => {
    const program = Effect.gen(function* () {
      const requests = yield* Queue.bounded<DetachRequest>(1);
      const first = new StubSocket(connectionData("first"));
      const overflow = new StubSocket(connectionData("overflow"));
      let overflowed: DetachRequest | undefined;

      const enqueue = enqueueDetach(requests, "allMids:", (request) => {
        overflowed = request;
      });

      enqueue(first);
      expect(overflowed).toBeUndefined();

      enqueue(overflow);
      expect(overflowed?.ws).toBe(overflow);
      expect(overflow.closed).toEqual({ code: 1013, reason: "client too slow" });
    });

    await Effect.runPromise(program);
  });
});

describe("Market WS capacity limits", () => {
  it("rejects a join when the bucket is at its client cap without disturbing clients", async () => {
    const buckets = Ref.makeUnsafe(new Map<string, Bucket>());
    const subscription = { channel: "allMids" as const };
    const key = "allMids:";

    const program = Effect.gen(function* () {
      const first = new StubSocket(connectionData("first"));
      expect((yield* joinBucket(buckets, first, subscription, key)).created).toBe(true);

      for (let index = 1; index < MAX_CLIENTS_PER_BUCKET; index++) {
        const client = new StubSocket(connectionData(`client-${index}`));
        yield* joinBucket(buckets, client, subscription, key);
      }
      expect(requireBucket(buckets, key).clients.size).toBe(MAX_CLIENTS_PER_BUCKET);

      const overflow = new StubSocket(connectionData("overflow"));
      const error = yield* joinBucket(buckets, overflow, subscription, key).pipe(Effect.flip);

      expect(error).toBeInstanceOf(BucketJoinError);
      expect((error as BucketJoinError).reason).toBe("bucket_full");
      const after = requireBucket(buckets, key);
      expect(after.clients.size).toBe(MAX_CLIENTS_PER_BUCKET);
      expect(after.clients.has(first)).toBe(true);
      expect(after.clients.has(overflow)).toBe(false);
      expect(Ref.getUnsafe(overflow.data.subscriptions).size).toBe(0);
    });

    await Effect.runPromise(program);
  });

  it("rejects a new bucket once MAX_BUCKETS is reached", async () => {
    // joinBucket only reads the map size for the cap, so placeholders suffice.
    const placeholder = {} as Bucket;
    const filled = new Map<string, Bucket>();
    for (let index = 0; index < MAX_BUCKETS; index++) {
      filled.set(`bucket-${index}`, placeholder);
    }
    const buckets = Ref.makeUnsafe(filled);
    const ws = new StubSocket(connectionData("overflow"));

    const error = await Effect.runPromise(
      joinBucket(buckets, ws, { channel: "allMids" }, "allMids:new").pipe(Effect.flip),
    );

    expect(error).toBeInstanceOf(BucketJoinError);
    expect((error as BucketJoinError).reason).toBe("too_many_buckets");
    expect(Ref.getUnsafe(buckets).size).toBe(MAX_BUCKETS);
    expect(Ref.getUnsafe(buckets).has("allMids:new")).toBe(false);
  });
});

describe("Market WS market allowlist", () => {
  it("rejects an unknown symbol with an error frame and creates no bucket", async () => {
    const captured: Captured = { buckets: undefined };
    const layer = makeLayer(captured);

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const buckets = requireBuckets(captured.buckets);
      const ws = new StubSocket(hub.createConnectionData());

      yield* hub.handleOpen(ws);
      yield* hub.handleMessage(
        ws,
        JSON.stringify({
          type: "subscribe",
          subscription: { channel: "candle", symbol: "NOPE", interval: "1m" },
        }),
      );

      expect(sentFrames(ws)).toContainEqual(
        expect.objectContaining({ type: "error", code: "unknown_market" }),
      );
      expect(Ref.getUnsafe(buckets).size).toBe(0);
      // The rejected frame must not leave a phantom connection subscription.
      expect((yield* Ref.get(ws.data.subscriptions)).size).toBe(0);
    });

    await Effect.runPromise(program.pipe(Effect.provide(layer)));
  });

  it("joins a symbol that the provider's aggregated markets contain", async () => {
    const captured: Captured = { buckets: undefined };
    const layer = makeLayer(captured);

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const buckets = requireBuckets(captured.buckets);
      const ws = new StubSocket(hub.createConnectionData());

      yield* hub.handleOpen(ws);
      yield* hub.handleMessage(
        ws,
        JSON.stringify({
          type: "subscribe",
          subscription: { channel: "candle", symbol: "BTC", interval: "1m" },
        }),
      );

      expect(sentFrames(ws)).toContainEqual(expect.objectContaining({ type: "subscribed" }));
      expect(Ref.getUnsafe(buckets).has("candle:BTC:1m")).toBe(true);
      expect(requireBucket(buckets, "candle:BTC:1m").clients.has(ws)).toBe(true);
    });

    await Effect.runPromise(program.pipe(Effect.provide(layer)));
  });

  it("rejects an unknown dex without creating an allMids bucket", async () => {
    const captured: Captured = { buckets: undefined };
    const layer = makeLayer(captured);

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const buckets = requireBuckets(captured.buckets);
      const ws = new StubSocket(hub.createConnectionData());

      yield* hub.handleOpen(ws);
      yield* hub.handleMessage(
        ws,
        JSON.stringify({
          type: "subscribe",
          subscription: { channel: "allMids", dex: "unknown-dex" },
        }),
      );

      expect(sentFrames(ws)).toContainEqual(
        expect.objectContaining({ type: "error", code: "unknown_dex" }),
      );
      expect(Ref.getUnsafe(buckets).size).toBe(0);
    });

    await Effect.runPromise(program.pipe(Effect.provide(layer)));
  });
});

describe("Market WS subscribe exhaustion teardown", () => {
  it("closes the bucket scope and releases its fibers when retries exhaust", async () => {
    const captured: Captured = { buckets: undefined };
    const layer = makeLayer(captured);
    const iterations = 3;
    let finalized = 0;

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const buckets = requireBuckets(captured.buckets);

      for (let iteration = 0; iteration < iterations; iteration++) {
        const ws = new StubSocket(
          hub.createConnectionData({ channel: "allMids", symbol: "NOT_A_MARKET" }),
        );
        yield* hub.handleOpen(ws);

        // Probe the bucket's own scope: the retry-exhaustion path must close it.
        const bucket = requireBucket(buckets, "allMids:");
        yield* Scope.addFinalizer(
          bucket.scope,
          Effect.sync(() => {
            finalized += 1;
          }),
        );

        // Drive the retry schedule (and the outer re-arm delays) to exhaustion.
        for (let step = 0; step < 60 && Ref.getUnsafe(buckets).size > 0; step++) {
          yield* TestClock.adjust("2 seconds");
          yield* Effect.yieldNow;
        }

        // The registry entry is gone and its scope finalizer ran exactly once.
        expect(Ref.getUnsafe(buckets).size).toBe(0);
        expect(finalized).toBe(iteration + 1);
      }

      // Repeating the cycle never accumulates unclosed buckets/scopes/fibers.
      expect(finalized).toBe(iterations);
    });

    await Effect.runPromise(Effect.provide(program.pipe(Effect.provide(layer)), TestClock.layer()));
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

describe("Market WS spot symbol resolution", () => {
  it("resolves a spot wire id, raw pair, and bare coin to the same upstream subscription", async () => {
    const [wireId, rawPair, bareCoin] = await Effect.runPromise(
      Effect.all([resolveUpstream("@203"), resolveUpstream("DBL/USDC"), resolveUpstream("DBL")]),
    );

    for (const subscriptions of [wireId, rawPair, bareCoin]) {
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0]).toEqual(expect.objectContaining({ type: "candle", coin: "@203" }));
    }
  });

  it("fails an unknown symbol with the resolver error naming the keys tried", async () => {
    const error = await Effect.runPromise(Effect.flip(resolveUpstream("NOPE")));

    expect(error).toBeInstanceOf(WebSocketSubscribeError);
    expect(error.message).toContain("rawCoin");
    expect(error.message).toContain("coin");
    expect(error.message).toContain("name");
  });
});
