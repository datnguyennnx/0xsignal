import { describe, expect, it } from "vitest";
import { Deferred, Effect, Option, Predicate, Ref, Scope } from "effect";
import type { ServerWebSocket, ServerWebSocketSendStatus, WebSocketReadyState } from "bun";
import {
  type ISubscription,
  type ISubscriptionTransport,
  SubscriptionClient,
} from "@nktkas/hyperliquid";
import { buildMarketWsBucketKey } from "../../../integrations/hyperliquid/streams/bucket-key";
import { parseMarketWsSubscription } from "../../../modules/market-data";
import {
  type MarketStreamError,
  MarketStreamHub,
  type Bucket,
  type MarketWsConnectionData,
  type MarketWsConnectionSubscription,
  type MarketWsSubscription,
} from "../../../integrations/hyperliquid/streams/hub-types";
import { makeMarketStreamHubLayer } from "../../../integrations/hyperliquid/streams/hub";
import { subscribeUpstream } from "../../../integrations/hyperliquid/streams/hub-subscription";
import {
  MAX_CLIENT_BUFFER_BYTES,
  broadcast,
} from "../../../integrations/hyperliquid/streams/hub-broadcast";

const stubUpstream: ISubscription = { unsubscribe: () => Promise.resolve() };

const unusedTransport: ISubscriptionTransport = {
  subscribe: () => Promise.reject(new Error("unused transport")),
};

const makeSubscriptionClient = (methods: Partial<SubscriptionClient>): SubscriptionClient =>
  Object.assign(new SubscriptionClient({ transport: unusedTransport }), methods);

const createBucket = (subscription: MarketWsSubscription): Bucket => ({
  key: buildMarketWsBucketKey(subscription),
  subscription,
  clients: new Set(),
  state: { _tag: "idle" },
  upstream: Option.none(),
  retryCount: 0,
  subscribeFiber: Option.none(),
  scope: Scope.makeUnsafe(),
});

const noopDetach = () => {};

const makeBucket = (subscription: MarketWsSubscription, clients: Iterable<StubSocket>): Bucket => ({
  key: buildMarketWsBucketKey(subscription),
  subscription,
  clients: new Set(clients),
  state: { _tag: "idle" },
  upstream: Option.none(),
  retryCount: 0,
  subscribeFiber: Option.none(),
  scope: Scope.makeUnsafe(),
});

class StubSocket implements ServerWebSocket<MarketWsConnectionData> {
  readonly subscriptions: string[] = [];
  readonly remoteAddress = "127.0.0.1";
  readonly readyState: WebSocketReadyState = 1;
  bufferedAmount: number;
  closed: { readonly code?: number; readonly reason?: string } | undefined;

  constructor(
    readonly data: MarketWsConnectionData,
    private readonly onSend: (text: string) => void,
    bufferedAmount = 0,
  ) {
    this.bufferedAmount = bufferedAmount;
  }

  send(
    data: string | ArrayBufferLike | ArrayBufferView,
    _compress?: boolean,
  ): ServerWebSocketSendStatus {
    if (typeof data === "string") this.onSend(data);
    return 0;
  }

  sendText(data: string, compress?: boolean): ServerWebSocketSendStatus {
    return this.send(data, compress);
  }

  sendBinary(
    data: ArrayBufferLike | ArrayBufferView,
    compress?: boolean,
  ): ServerWebSocketSendStatus {
    return this.send(data, compress);
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
    return this.bufferedAmount;
  }
}

const makeClient = (
  data: MarketWsConnectionData,
  send: (text: string) => void,
  bufferedAmount = 0,
): StubSocket => new StubSocket(data, send, bufferedAmount);

const emptyConnectionData = (id: string): MarketWsConnectionData => ({
  id,
  subscriptions: Ref.makeUnsafe<Map<string, MarketWsConnectionSubscription>>(new Map()),
});

const requireParsed = (parsed: ReturnType<typeof parseMarketWsSubscription>) => {
  if (!parsed.ok) throw new Error("Expected parsed subscriptions");
  return parsed.data;
};

const isListener = (value: unknown): value is (event: unknown) => void =>
  typeof value === "function";

const makeAllMidsHandler =
  (subscription: ISubscription) =>
  (first: unknown, second?: unknown): Promise<ISubscription> => {
    const notify = isListener(first) ? first : second;
    if (isListener(notify)) notify({ data: { allMids: { BTC: "100" } } });
    return Promise.resolve(subscription);
  };

const makeFailingSlowL2BookLegs = (onFastUnsubscribe: () => void) => {
  let calls = 0;
  return {
    l2Book: () => {
      calls++;
      if (calls === 1) {
        return Promise.resolve<ISubscription>({
          unsubscribe: () => {
            onFastUnsubscribe();
            return Promise.resolve();
          },
        });
      }
      return Promise.reject(new Error("slow leg rejected"));
    },
    calls: () => calls,
  };
};

describe("Market WS subscription parser", () => {
  it("parses candle subscription with defaults", () => {
    const params = new URLSearchParams({ channel: "candle", symbol: "btc" });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: true,
      data: {
        channel: "candle",
        symbol: "BTC",
        interval: "1m",
      },
    });
  });

  it("parses builder-perp symbol with canonical dex casing", () => {
    const params = new URLSearchParams({ channel: "candle", symbol: "XYZ:clusdt" });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: true,
      data: {
        channel: "candle",
        symbol: "xyz:CL",
        interval: "1m",
      },
    });
  });

  it("parses l2Book subscription with nSigFigs aliases", () => {
    const params = new URLSearchParams({
      channel: "l2Book",
      symbol: "ETH",
      depth: "4",
    });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: true,
      data: {
        channel: "l2Book",
        symbol: "ETH",
        nSigFigs: 4,
      },
    });
  });

  it("prefers explicit nSigFigs over depth alias for l2Book; depth becomes maxDepth", () => {
    const params = new URLSearchParams({
      channel: "l2Book",
      symbol: "ETH",
      nSigFigs: "3",
      depth: "5",
    });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: true,
      data: {
        channel: "l2Book",
        symbol: "ETH",
        nSigFigs: 3,
        depth: 5,
      },
    });
  });

  it("rejects malformed l2Book precision values", () => {
    const params = new URLSearchParams({
      channel: "l2Book",
      symbol: "ETH",
      nSigFigs: "2abc",
    });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: false,
      status: 400,
      message: "Invalid nSigFigs/depth. Supported values are 2, 3, 4, 5.",
    });
  });

  it("supports allMids without symbol", () => {
    const params = new URLSearchParams({ channel: "allMids" });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: true,
      data: {
        channel: "allMids",
        dex: undefined,
      },
    });
  });

  it("rejects invalid channel", () => {
    const params = new URLSearchParams({ channel: "ticker", symbol: "BTC" });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: false,
      status: 400,
      message: "Unsupported channel: ticker",
    });
  });

  it("rejects invalid interval", () => {
    const params = new URLSearchParams({ channel: "candle", symbol: "BTC", interval: "10m" });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: false,
      status: 400,
      message: "Unsupported interval: 10m",
    });
  });

  it("rejects unsupported long intervals not backed by HTTP/", () => {
    const threeDay = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "BTC", interval: "3d" }),
    );
    const oneMonth = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "BTC", interval: "1M" }),
    );

    expect(threeDay).toEqual({
      ok: false,
      status: 400,
      message: "Unsupported interval: 3d",
    });

    expect(oneMonth).toEqual({
      ok: false,
      status: 400,
      message: "Unsupported interval: 1M",
    });
  });

  it("builds stable bucket keys", () => {
    expect(buildMarketWsBucketKey({ channel: "candle", symbol: "BTC", interval: "1m" })).toBe(
      "candle:BTC:1m",
    );
    expect(buildMarketWsBucketKey({ channel: "l2Book", symbol: "ETH", nSigFigs: 5 })).toBe(
      "l2Book:ETH:5",
    );
    expect(buildMarketWsBucketKey({ channel: "trades", symbol: "SOL" })).toBe("trades:SOL");
    expect(buildMarketWsBucketKey({ channel: "allMids" })).toBe("allMids:");
  });

  it("changes l2Book bucket key when precision changes", () => {
    const sig5 = buildMarketWsBucketKey({ channel: "l2Book", symbol: "ETH", nSigFigs: 5 });
    const sig3 = buildMarketWsBucketKey({ channel: "l2Book", symbol: "ETH", nSigFigs: 3 });

    expect(sig5).toBe("l2Book:ETH:5");
    expect(sig3).toBe("l2Book:ETH:3");
    expect(sig5).not.toBe(sig3);
  });

  it("builds stable builder-perp bucket keys across mixed casing", () => {
    const parsedA = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "XYZ:clusdt", interval: "1m" }),
    );
    const parsedB = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "xyz:CL", interval: "1m" }),
    );

    expect(parsedA.ok).toBe(true);
    expect(parsedB.ok).toBe(true);
    const subscriptionA = requireParsed(parsedA);
    const subscriptionB = requireParsed(parsedB);

    expect(buildMarketWsBucketKey(subscriptionA)).toBe(buildMarketWsBucketKey(subscriptionB));
  });
});

describe("Market WS emitter contract", () => {
  it("emits stable market envelope for candle", async () => {
    const subscriptionClient = makeSubscriptionClient({
      candle: (_params, onEvent) => {
        onEvent({ t: 1, T: 2, s: "BTC", i: "1m", o: "1", c: "1", h: "2", l: "0", v: "3", n: 1 });
        return Promise.resolve(stubUpstream);
      },
    });

    const bucket = createBucket({ channel: "candle", symbol: "BTC", interval: "1m" });

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach, () => bucket),
    );

    expect(upstream).toBeDefined();
    expect(typeof upstream.unsubscribe).toBe("function");
  });

  it("emits stable market envelope for l2Book", async () => {
    let callCount = 0;
    const subscriptionClient = makeSubscriptionClient({
      l2Book: (_params, onEvent) => {
        callCount++;
        // Hybrid model: l2Book is called twice (fast + slow).
        // First call (fast) and second call (slow) both fire the event.
        onEvent({
          coin: "ETH",
          time: 1,
          levels: [[{ px: "100", sz: "1", n: 1 }], []],
        });
        return Promise.resolve(stubUpstream);
      },
    });

    const bucket = createBucket({ channel: "l2Book", symbol: "ETH", nSigFigs: 4 });

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach, () => bucket),
    );

    expect(upstream).toBeDefined();
    expect(typeof upstream.unsubscribe).toBe("function");
    // Both fast and slow subscriptions are established
    expect(callCount).toBe(2);
  });

  it("subscribes the slow l2Book leg only after fast, and cleans up fast on failure", async () => {
    let fastUnsubscribed = 0;
    const legs = makeFailingSlowL2BookLegs(() => {
      fastUnsubscribed++;
    });

    const subscriptionClient = makeSubscriptionClient({ l2Book: legs.l2Book });
    const bucket = createBucket({ channel: "l2Book", symbol: "ETH", nSigFigs: 4 });

    await expect(
      Effect.runPromise(
        subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach, () => bucket),
      ),
    ).rejects.toBeDefined();

    // The fast leg is created first; the slow leg is created only afterwards.
    expect(legs.calls()).toBe(2);
    expect(fastUnsubscribed).toBe(1);
  });

  it("emits stable market envelope for trades", async () => {
    const subscriptionClient = makeSubscriptionClient({
      trades: (_params, onEvent) => {
        onEvent([
          {
            coin: "SOL",
            side: "B",
            px: "100",
            sz: "1",
            time: 1,
            hash: "0x00",
            tid: 1,
            users: ["0x00", "0x00"],
          },
        ]);
        return Promise.resolve(stubUpstream);
      },
    });

    const bucket = createBucket({ channel: "trades", symbol: "SOL" });

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach, () => bucket),
    );

    expect(upstream).toBeDefined();
    expect(typeof upstream.unsubscribe).toBe("function");
  });

  it("emits stable market envelope for allMids", async () => {
    const subscriptionClient = makeSubscriptionClient({
      // v0.33.0: allMids(listener, options?) or allMids(params, listener, options?)
      allMids: makeAllMidsHandler(stubUpstream),
    });

    const bucket = createBucket({ channel: "allMids" });

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach, () => bucket),
    );

    expect(upstream).toBeDefined();
    expect(typeof upstream.unsubscribe).toBe("function");
  });
});

describe("Market WS fire-and-forget broadcast", () => {
  // Bun's ServerWebSocket instance also exposes close/terminate/readyState; a stub needs data + send.
  const candleSubscription: MarketWsSubscription = {
    channel: "candle",
    symbol: "BTC",
    interval: "1m",
  };

  it("sends every message to every client below the buffer ceiling", () => {
    const sentMessages: string[] = [];

    const mockWs = makeClient(emptyConnectionData("conn-1"), (data) => {
      sentMessages.push(data);
    });

    const bucket = makeBucket(candleSubscription, [mockWs]);

    const payload = { type: "market", channel: "candle", data: [{ t: 1 }] };
    broadcast(bucket, payload, noopDetach);

    // Message is sent, not coalesced
    expect(sentMessages).toEqual([JSON.stringify(payload)]);
  });

  it("reports a client whose send buffer exceeds the ceiling for detach", () => {
    const mockWs = makeClient(
      emptyConnectionData("conn-slow"),
      () => {
        throw new Error("a stalled client must not be sent to");
      },
      MAX_CLIENT_BUFFER_BYTES + 1,
    );

    const bucket = makeBucket(candleSubscription, [mockWs]);
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    broadcast(bucket, { type: "market", channel: "candle", data: [] }, (ws) => {
      detached.push(ws);
    });

    expect(detached).toEqual([mockWs]);
  });

  it("reports a client whose send throws for detach", () => {
    const mockWs = makeClient(emptyConnectionData("conn-faulty"), () => {
      throw new Error("buffer full");
    });

    const bucket = makeBucket(candleSubscription, [mockWs]);
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    broadcast(bucket, { type: "market", channel: "candle", data: [] }, (ws) => {
      detached.push(ws);
    });

    expect(detached).toEqual([mockWs]);
  });

  it("sends to a healthy client even when another client throws", () => {
    const sentMessages: string[] = [];

    const faultyWs = makeClient(emptyConnectionData("faulty"), () => {
      throw new Error("buffer full");
    });

    const healthyWs = makeClient(emptyConnectionData("healthy"), (data) => {
      sentMessages.push(data);
    });

    const bucket = makeBucket(candleSubscription, [faultyWs, healthyWs]);

    const payload = { type: "market", channel: "candle", data: [{ t: 1 }] };
    broadcast(bucket, payload, noopDetach);

    // Healthy client still gets the message
    expect(sentMessages).toEqual([JSON.stringify(payload)]);
  });
});

const waitForEmptyBuckets = (buckets: Ref.Ref<Map<string, Bucket>>): Effect.Effect<void> =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 100; attempt++) {
      const map = yield* Ref.get(buckets);
      if (map.size === 0) return;
      yield* Effect.yieldNow;
    }
  });

const waitFor = (predicate: () => boolean): Effect.Effect<void> =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (predicate()) return;
      yield* Effect.sleep("5 millis");
    }
    throw new Error("Test condition was not satisfied");
  });

const isTestRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseTestFrame = (text: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(text);
  if (!isTestRecord(parsed)) throw new Error("WS frame is not a JSON object");
  return parsed;
};

const marketChannels = (frames: readonly Record<string, unknown>[]): Set<string> => {
  const channels = new Set<string>();
  for (const frame of frames) {
    if (frame.type === "market" && typeof frame.channel === "string") channels.add(frame.channel);
  }
  return channels;
};

const countMarketFrames = (frames: readonly Record<string, unknown>[], channel: string): number =>
  frames.filter((frame) => frame.type === "market" && frame.channel === channel).length;

const allBucketsSubscribed = (buckets: Ref.Ref<Map<string, Bucket>>): boolean => {
  const map = Ref.getUnsafe(buckets);
  return map.size === 3 && [...map.values()].every((bucket) => Option.isSome(bucket.upstream));
};

const bucketHasUpstream = (buckets: Ref.Ref<Map<string, Bucket>>, key: string): boolean => {
  const bucket = Ref.getUnsafe(buckets).get(key);
  return bucket !== undefined && Option.isSome(bucket.upstream);
};

const requireDefined = <A>(value: A | undefined, message: string): A => {
  if (value === undefined) throw new Error(message);
  return value;
};

describe("Market WS hub lifecycle", () => {
  const allMidsSubscription: MarketWsSubscription = { channel: "allMids" };

  // allMids needs no market lookup, so every other provider method is unused.
  const stubProvider = {
    getCandleSnapshot: () => Effect.die("unused"),
    getAllMids: () => Effect.die("unused"),
    getAggregatedMarkets: () => Effect.succeed([]),
    getTicker: () => Effect.die("unused"),
    getOrderBook: () => Effect.die("unused"),
    getTradeAnnotation: () => Effect.die("unused"),
  };

  it("does not resurrect a bucket closed while its subscribe was in flight", async () => {
    const started = Deferred.makeUnsafe<void>();
    const unsubscribed: string[] = [];
    let subscribeCalls = 0;
    let resolveSubscribe: ((sub: ISubscription) => void) | undefined;
    let transportClosed = false;

    const subscriptionClient = makeSubscriptionClient({
      allMids: (_first: unknown, _second?: unknown) => {
        subscribeCalls++;
        Deferred.doneUnsafe(started, Effect.void);
        return new Promise<ISubscription>((resolve) => {
          resolveSubscribe = resolve;
        });
      },
    });

    const captured: { buckets: Ref.Ref<Map<string, Bucket>> | undefined } = {
      buckets: undefined,
    };

    const hubLayer = makeMarketStreamHubLayer(stubProvider, {
      createClient: () => ({
        subscriptionClient,
        close: () => {
          transportClosed = true;
        },
      }),
      onAcquire: (buckets) => {
        captured.buckets = buckets;
      },
    });

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const ws = new StubSocket(hub.createConnectionData(allMidsSubscription), () => {});

      yield* hub.handleOpen(ws);
      yield* Deferred.await(started);

      yield* Effect.forkChild(hub.handleClose(ws));

      const buckets = requireDefined(captured.buckets, "hub did not expose its buckets");
      yield* waitForEmptyBuckets(buckets);

      // Resolve only after close removed the bucket: the old code re-inserted
      // it here with a live upstream and zero clients.
      const resolve = requireDefined(resolveSubscribe, "subscribe never started");
      resolve({
        unsubscribe: () => {
          unsubscribed.push("allMids");
          return Promise.resolve();
        },
      });

      yield* Effect.sleep("20 millis");

      const map = yield* Ref.get(buckets);
      expect(subscribeCalls).toBe(1);
      expect(map.has("allMids:")).toBe(false);
      expect(unsubscribed).toEqual(["allMids"]);
    });

    await Effect.runPromise(Effect.provide(program, hubLayer));

    expect(transportClosed).toBe(true);
  });

  it("surfaces a send failure as a MarketStreamError", async () => {
    const harness = makeTestHarness();

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const ws = new StubSocket(hub.createConnectionData(), () => {
        throw new Error("socket gone");
      });

      const error = yield* hub.handleOpen(ws).pipe(Effect.flip);
      expect(Predicate.isTagged(error, "MarketStreamError")).toBe(true);
      expect(error.code).toBe("SEND_FAILED");
    });

    await Effect.runPromise(Effect.provide(program, harness.layer));
  });
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

const makeTestProvider = () => ({
  getCandleSnapshot: () => Effect.die("unused"),
  getAllMids: () => Effect.die("unused"),
  getAggregatedMarkets: () => Effect.succeed([makePerpAsset("BTC"), makePerpAsset("ETH")]),
  getTicker: () => Effect.die("unused"),
  getOrderBook: () => Effect.die("unused"),
  getTradeAnnotation: () => Effect.die("unused"),
});

const makeTestHarness = () => {
  const unsubscribed: string[] = [];
  const allMidsListeners: ((event: unknown) => void)[] = [];
  const captured: { buckets: Ref.Ref<Map<string, Bucket>> | undefined } = { buckets: undefined };

  const subscriptionClient = makeSubscriptionClient({
    candle: (_params, onEvent) => {
      onEvent({ t: 1, T: 2, s: "BTC", i: "1m", o: "1", c: "1", h: "2", l: "0", v: "3", n: 1 });
      return Promise.resolve({
        unsubscribe: () => {
          unsubscribed.push("candle");
          return Promise.resolve();
        },
      });
    },
    l2Book: (params, onEvent) => {
      const fast = params.fast === true;
      onEvent({
        coin: "ETH",
        time: 1,
        levels: [[{ px: "100", sz: "1", n: 1 }], []],
        ...(fast ? { fast: true } : {}),
      });
      return Promise.resolve({
        unsubscribe: () => {
          unsubscribed.push(fast ? "l2Book:fast" : "l2Book:slow");
          return Promise.resolve();
        },
      });
    },
    allMids: (first: unknown, second?: unknown) => {
      const notify = isListener(first) ? first : second;
      if (isListener(notify)) {
        allMidsListeners.push(notify);
        notify({ data: { allMids: { BTC: "100" } } });
      }
      return Promise.resolve({
        unsubscribe: () => {
          unsubscribed.push("allMids");
          return Promise.resolve();
        },
      });
    },
  });

  const layer = makeMarketStreamHubLayer(makeTestProvider(), {
    createClient: () => ({ subscriptionClient, close: () => {} }),
    onAcquire: (buckets) => {
      captured.buckets = buckets;
    },
  });

  return {
    layer,
    captured,
    unsubscribed,
    emitAllMids: () => {
      for (const notify of allMidsListeners) {
        notify({ data: { allMids: { BTC: "101" } } });
      }
    },
  };
};

const MULTI_SUBSCRIPTIONS: readonly MarketWsSubscription[] = [
  { channel: "candle", symbol: "BTC", interval: "1m" },
  { channel: "l2Book", symbol: "ETH", nSigFigs: 4 },
  { channel: "allMids" },
];

type SubscriptionFrameHub = {
  readonly handleMessage: (
    ws: ServerWebSocket<MarketWsConnectionData>,
    raw: string | Uint8Array,
  ) => Effect.Effect<void, MarketStreamError>;
};

const sendSubscriptionFrame = (
  hub: SubscriptionFrameHub,
  ws: StubSocket,
  type: "subscribe" | "unsubscribe",
  subscription: MarketWsSubscription,
): Effect.Effect<void, MarketStreamError> =>
  hub.handleMessage(ws, JSON.stringify({ type, subscription }));

const subscribeAll = (
  hub: SubscriptionFrameHub,
  ws: StubSocket,
): Effect.Effect<void, MarketStreamError> =>
  Effect.gen(function* () {
    for (const subscription of MULTI_SUBSCRIPTIONS) {
      yield* sendSubscriptionFrame(hub, ws, "subscribe", subscription);
    }
  });

describe("Market WS multiplexed subscriptions", () => {
  it("carries candle, l2Book, and allMids on one connection", async () => {
    const harness = makeTestHarness();
    const frames: Record<string, unknown>[] = [];

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const ws = new StubSocket(hub.createConnectionData(), (text) => {
        frames.push(parseTestFrame(text));
      });

      yield* hub.handleOpen(ws);
      yield* subscribeAll(hub, ws);
      yield* waitFor(() => marketChannels(frames).size === 3);

      expect(frames.filter((frame) => frame.type === "subscribed")).toHaveLength(3);
      expect([...marketChannels(frames)].toSorted()).toEqual(["allMids", "candle", "l2Book"]);

      const buckets = requireDefined(harness.captured.buckets, "hub did not expose its buckets");
      const map = yield* Ref.get(buckets);
      expect([...map.keys()].toSorted()).toEqual(["allMids:", "candle:BTC:1m", "l2Book:ETH:4"]);
      for (const bucket of map.values()) {
        expect(bucket.clients.has(ws)).toBe(true);
      }
    });

    await Effect.runPromise(Effect.provide(program, harness.layer));
  });

  it("keeps the other two channels live after unsubscribing one", async () => {
    const harness = makeTestHarness();
    const frames: Record<string, unknown>[] = [];

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const ws = new StubSocket(hub.createConnectionData(), (text) => {
        frames.push(parseTestFrame(text));
      });

      yield* hub.handleOpen(ws);
      yield* subscribeAll(hub, ws);
      yield* waitFor(() => marketChannels(frames).size === 3);

      yield* sendSubscriptionFrame(hub, ws, "unsubscribe", MULTI_SUBSCRIPTIONS[0]);
      expect(frames.filter((frame) => frame.type === "unsubscribed")).toHaveLength(1);

      const buckets = requireDefined(harness.captured.buckets, "hub did not expose its buckets");
      const map = yield* Ref.get(buckets);
      expect(map.has("candle:BTC:1m")).toBe(false);
      expect([...map.keys()].toSorted()).toEqual(["allMids:", "l2Book:ETH:4"]);
      expect(map.get("allMids:")?.clients.has(ws)).toBe(true);
      expect(map.get("l2Book:ETH:4")?.clients.has(ws)).toBe(true);

      const before = countMarketFrames(frames, "allMids");
      harness.emitAllMids();
      yield* waitFor(() => countMarketFrames(frames, "allMids") > before);
    });

    await Effect.runPromise(Effect.provide(program, harness.layer));
  });

  it("releases every subscription and deletes every empty bucket on close", async () => {
    const harness = makeTestHarness();
    const frames: Record<string, unknown>[] = [];

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const ws = new StubSocket(hub.createConnectionData(), (text) => {
        frames.push(parseTestFrame(text));
      });

      yield* hub.handleOpen(ws);
      yield* subscribeAll(hub, ws);
      yield* waitFor(() => marketChannels(frames).size === 3);

      const buckets = requireDefined(harness.captured.buckets, "hub did not expose its buckets");
      yield* waitFor(() => allBucketsSubscribed(buckets));

      yield* hub.handleClose(ws);
      yield* waitForEmptyBuckets(buckets);

      expect([...harness.unsubscribed].toSorted()).toEqual([
        "allMids",
        "candle",
        "l2Book:fast",
        "l2Book:slow",
      ]);
      expect((yield* Ref.get(ws.data.subscriptions)).size).toBe(0);
      expect((yield* Ref.get(buckets)).size).toBe(0);
    });

    await Effect.runPromise(Effect.provide(program, harness.layer));
  });

  it("rejects an invalid subscription frame and keeps the socket open", async () => {
    const harness = makeTestHarness();
    const frames: Record<string, unknown>[] = [];

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const ws = new StubSocket(hub.createConnectionData(), (text) => {
        frames.push(parseTestFrame(text));
      });

      yield* hub.handleOpen(ws);
      yield* hub.handleMessage(
        ws,
        JSON.stringify({ type: "subscribe", subscription: { channel: "ticker", symbol: "BTC" } }),
      );

      const error = frames.find((frame) => frame.type === "error");
      expect(error).toMatchObject({
        code: "invalid_subscription",
        message: "Unsupported channel: ticker",
      });
      expect(frames.some((frame) => frame.type === "subscribed")).toBe(false);
      expect(ws.closed).toBeUndefined();
      expect(ws.readyState).toBe(1);

      yield* hub.handleMessage(ws, "ping");
      expect(frames.some((frame) => frame.type === "pong")).toBe(true);
    });

    await Effect.runPromise(Effect.provide(program, harness.layer));
  });

  it("releases an emptied bucket when its last client is detached", async () => {
    const harness = makeTestHarness();

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const slow = new StubSocket(hub.createConnectionData(), () => {});

      yield* hub.handleOpen(slow);
      yield* sendSubscriptionFrame(hub, slow, "subscribe", { channel: "allMids" });

      const buckets = requireDefined(harness.captured.buckets, "hub did not expose its buckets");
      yield* waitFor(() => bucketHasUpstream(buckets, "allMids:"));

      // Only now does the client stop reading; the subscribe handshake has
      // already completed, so the detach below is the broadcast path.
      slow.bufferedAmount = MAX_CLIENT_BUFFER_BYTES + 1;
      harness.emitAllMids();
      yield* waitFor(() => slow.closed !== undefined);
      expect(slow.closed).toEqual({ code: 1013, reason: "client too slow" });

      // The drain releases the bucket, not just the client; otherwise the
      // upstream subscription and scope outlive every reader.
      yield* waitFor(() => Ref.getUnsafe(buckets).size === 0);
      expect(harness.unsubscribed).toContain("allMids");
    });

    await Effect.runPromise(Effect.provide(program, harness.layer));
  });

  it("auto-subscribes a legacy query-param connection and accepts a bare upgrade", async () => {
    const { upgradeMarketWs } = await import("../ws");
    const harness = makeTestHarness();
    const legacyFrames: Record<string, unknown>[] = [];
    const bareFrames: Record<string, unknown>[] = [];

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const upgrades: MarketWsConnectionData[] = [];
      const server = {
        upgrade: (_req: Request, options: { readonly data: MarketWsConnectionData }) => {
          upgrades.push(options.data);
          return true;
        },
      };

      const legacyUrl = "http://localhost/api/ws/market?channel=candle&symbol=btc&interval=1m";
      const legacyResponse = upgradeMarketWs(
        new URL(legacyUrl),
        new Request(legacyUrl),
        server,
        hub,
      );
      expect(legacyResponse).toBeUndefined();

      const bareUrl = "http://localhost/api/ws/market";
      const bareResponse = upgradeMarketWs(new URL(bareUrl), new Request(bareUrl), server, hub);
      expect(bareResponse).toBeUndefined();

      const invalidResponse = upgradeMarketWs(
        new URL("http://localhost/api/ws/market?channel=ticker"),
        new Request("http://localhost/api/ws/market?channel=ticker"),
        server,
        hub,
      );
      expect(invalidResponse?.status).toBe(400);

      expect(upgrades).toHaveLength(2);
      const legacy = upgrades[0];
      const bare = upgrades[1];

      expect((yield* Ref.get(legacy.subscriptions)).size).toBe(1);
      expect((yield* Ref.get(bare.subscriptions)).size).toBe(0);

      const legacyWs = new StubSocket(legacy, (text) => {
        legacyFrames.push(parseTestFrame(text));
      });
      yield* hub.handleOpen(legacyWs);
      yield* waitFor(() => countMarketFrames(legacyFrames, "candle") > 0);

      const ready = legacyFrames.find((frame) => frame.type === "ready");
      expect(ready).toMatchObject({
        connectionId: legacy.id,
        subscription: { channel: "candle", symbol: "BTC", interval: "1m" },
      });

      const bareWs = new StubSocket(bare, (text) => {
        bareFrames.push(parseTestFrame(text));
      });
      yield* hub.handleOpen(bareWs);

      const bareReady = bareFrames.find((frame) => frame.type === "ready");
      expect(bareReady).toMatchObject({ type: "ready", connectionId: bare.id });
      expect(bareReady).not.toHaveProperty("subscription");

      yield* sendSubscriptionFrame(hub, bareWs, "subscribe", MULTI_SUBSCRIPTIONS[2]);
      expect(bareFrames.filter((frame) => frame.type === "subscribed")).toHaveLength(1);
    });

    await Effect.runPromise(Effect.provide(program, harness.layer));
  });
});
