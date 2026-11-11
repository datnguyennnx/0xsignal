import { describe, expect, it } from "vitest";
import { Deferred, Effect, Option, Predicate, Ref, Scope } from "effect";
import type { ServerWebSocket, WebSocketReadyState } from "bun";
import type {
  SubscribeOptions,
  Subscription,
  SubscriptionHandle,
  WsClient,
} from "@0xsignal/sdk-hyperliquid/subscription";
import { buildMarketWsBucketKey } from "../../../integrations/hyperliquid/streams/bucket-key";
import { parseMarketWsSubscription } from "../../../modules/market-data";
import { MAX_DEX_LENGTH, MAX_SYMBOL_LENGTH } from "../subscription-parser";
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

const makeHandle = (
  subscription: Subscription,
  release?: () => Promise<void>,
): SubscriptionHandle => ({
  subscription,
  unsubscribe: () => {},
  unsubscribeAsync: release ?? (() => Promise.resolve()),
});

type SubscribeFn = (
  subscription: Subscription,
  onData: (data: unknown) => void,
  options?: SubscribeOptions,
) => SubscriptionHandle;

const makeWsClient = (subscribe: SubscribeFn): WsClient => ({ subscribe }) as unknown as WsClient;

const createBucket = (subscription: MarketWsSubscription): Bucket => ({
  key: buildMarketWsBucketKey(subscription),
  subscription,
  clients: new Set(),
  state: { _tag: "idle" },
  upstream: Option.none(),
  lastSnapshot: { current: Option.none() },
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
  lastSnapshot: { current: Option.none() },
  retryCount: 0,
  subscribeFiber: Option.none(),
  scope: Scope.makeUnsafe(),
});

type MarketSocket = ServerWebSocket<MarketWsConnectionData>;
type SendArg = Parameters<MarketSocket["send"]>[0];
type SendBinaryArg = Parameters<MarketSocket["sendBinary"]>[0];
type SendStatus = ReturnType<MarketSocket["send"]>;
type PingArg = Parameters<MarketSocket["ping"]>[0];

class StubSocket implements MarketSocket {
  readonly subscriptions: string[] = [];
  readonly remoteAddress = "127.0.0.1";
  readonly readyState: WebSocketReadyState = 1;
  bufferedAmount: number;
  binaryType?: "nodebuffer" | "arraybuffer" | "uint8array" | "blob";
  closed: { readonly code?: number; readonly reason?: string } | undefined;
  private paused = false;

  constructor(
    readonly data: MarketWsConnectionData,
    private readonly onSend: (text: string) => void,
    bufferedAmount = 0,
  ) {
    this.bufferedAmount = bufferedAmount;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  send(data: SendArg, _compress?: boolean): SendStatus {
    if (typeof data === "string") this.onSend(data);
    return 1;
  }

  sendText(data: string, compress?: boolean): SendStatus {
    return this.send(data, compress);
  }

  sendBinary(data: SendBinaryArg, compress?: boolean): SendStatus {
    return this.send(data, compress);
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

  cork<R = unknown>(callback: (ws: MarketSocket) => R): R {
    throw new Error(`not implemented: ${typeof callback}`);
  }

  getBufferedAmount(): number {
    return this.bufferedAmount;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
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

const makeAllMidsHandler =
  (subscriptions: Subscription[] = []) =>
  (subscription: Subscription, onData: (data: unknown) => void): SubscriptionHandle => {
    subscriptions.push(subscription);
    onData({ data: { allMids: { BTC: "100" } } });
    return makeHandle(subscription);
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

  it("accepts the long intervals now in the shared interval set", () => {
    const threeDay = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "BTC", interval: "3d" }),
    );
    const oneMonth = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "BTC", interval: "1M" }),
    );

    expect(threeDay).toEqual({
      ok: true,
      data: { channel: "candle", symbol: "BTC", interval: "3d" },
    });

    expect(oneMonth).toEqual({
      ok: true,
      data: { channel: "candle", symbol: "BTC", interval: "1M" },
    });
  });

  it("rejects an over-length symbol", () => {
    const parsed = parseMarketWsSubscription(
      new URLSearchParams({
        channel: "candle",
        symbol: "B".repeat(MAX_SYMBOL_LENGTH + 1),
        interval: "1m",
      }),
    );

    expect(parsed).toMatchObject({ ok: false, status: 400 });
    if (parsed.ok) throw new Error("expected a rejection");
    expect(parsed.message).toContain("symbol");
  });

  it("rejects an illegal character in a symbol", () => {
    const parsed = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "BTC$", interval: "1m" }),
    );

    expect(parsed).toMatchObject({ ok: false, status: 400 });
    if (parsed.ok) throw new Error("expected a rejection");
    expect(parsed.message).toContain("symbol");
  });

  it("rejects an over-length dex", () => {
    const parsed = parseMarketWsSubscription(
      new URLSearchParams({
        channel: "allMids",
        dex: "d".repeat(MAX_DEX_LENGTH + 1),
      }),
    );

    expect(parsed).toMatchObject({ ok: false, status: 400 });
    if (parsed.ok) throw new Error("expected a rejection");
    expect(parsed.message).toContain("dex");
  });

  it("rejects an illegal character in a dex", () => {
    const parsed = parseMarketWsSubscription(
      new URLSearchParams({ channel: "allMids", dex: "../etc" }),
    );

    expect(parsed).toMatchObject({ ok: false, status: 400 });
    if (parsed.ok) throw new Error("expected a rejection");
    expect(parsed.message).toContain("dex");
  });

  it("accepts provider-shaped identifiers such as spot pairs", () => {
    const parsed = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "PURR/USDC", interval: "1m" }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("expected a valid subscription");
    expect(parsed.data.symbol).toBe("PURR/USDC");
  });

  it("builds stable bucket keys", () => {
    expect(buildMarketWsBucketKey({ channel: "candle", symbol: "BTC", interval: "1m" })).toBe(
      "candle:BTC:1m",
    );
    expect(buildMarketWsBucketKey({ channel: "l2Book", symbol: "ETH", nSigFigs: 5 })).toBe(
      "l2Book:ETH:5",
    );
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
    const subscriptions: Subscription[] = [];
    const subscriptionClient = makeWsClient((subscription, onData) => {
      subscriptions.push(subscription);
      onData({ t: 1, T: 2, s: "BTC", i: "1m", o: "1", c: "1", h: "2", l: "0", v: "3", n: 1 });
      return makeHandle(subscription);
    });

    const bucket = createBucket({ channel: "candle", symbol: "BTC", interval: "1m" });

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach, () => bucket),
    );

    expect(upstream).toBeDefined();
    expect(typeof upstream.unsubscribe).toBe("function");
    expect(subscriptions).toEqual([{ type: "candle", coin: "BTC", interval: "1m" }]);
  });

  it("subscribes l2Book once and broadcasts a full snapshot", async () => {
    const subscriptions: Subscription[] = [];
    const frames: string[] = [];
    const client = makeClient(emptyConnectionData("conn-l2"), (text) => {
      frames.push(text);
    });

    const subscriptionClient = makeWsClient((subscription, onData) => {
      subscriptions.push(subscription);
      onData({
        coin: "ETH",
        time: 1,
        levels: [[{ px: "100", sz: "1", n: 1 }], [{ px: "101", sz: "2", n: 1 }]],
      });
      return makeHandle(subscription);
    });

    const subscription: MarketWsSubscription = {
      channel: "l2Book",
      symbol: "ETH",
      nSigFigs: 4,
    };
    const bucket = makeBucket(subscription, [client]);

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach, () => bucket),
    );

    expect(upstream).toBeDefined();
    expect(typeof upstream.unsubscribe).toBe("function");
    expect(subscriptions).toEqual([{ type: "l2Book", coin: "ETH", nSigFigs: 4 }]);
    expect(frames.map(parseTestFrame)).toEqual([
      {
        type: "market",
        channel: "l2Book",
        nSigFigs: 4,
        data: {
          snapshot: {
            levels: [[{ px: "100", sz: "1", n: 1 }], [{ px: "101", sz: "2", n: 1 }]],
          },
        },
      },
    ]);
    expect(Option.isSome(bucket.lastSnapshot.current)).toBe(true);
  });

  it("slices every l2Book snapshot to the bucket's maxDepth", async () => {
    const frames: string[] = [];
    const client = makeClient(emptyConnectionData("conn-depth"), (text) => {
      frames.push(text);
    });

    const subscriptionClient = makeWsClient((subscription, onData) => {
      onData({
        coin: "ETH",
        time: 1,
        levels: [
          [
            { px: "100", sz: "1", n: 1 },
            { px: "99", sz: "2", n: 1 },
            { px: "98", sz: "3", n: 1 },
          ],
          [
            { px: "101", sz: "1", n: 1 },
            { px: "102", sz: "2", n: 1 },
            { px: "103", sz: "3", n: 1 },
          ],
        ],
      });
      return makeHandle(subscription);
    });

    const bucket = makeBucket({ channel: "l2Book", symbol: "ETH", nSigFigs: 4, depth: 2 }, [
      client,
    ]);

    await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach, () => bucket),
    );

    const frame = parseTestFrame(requireDefined(frames[0], "no snapshot frame"));
    expect(frame).toMatchObject({
      data: {
        snapshot: {
          levels: [
            [
              { px: "100", sz: "1", n: 1 },
              { px: "99", sz: "2", n: 1 },
            ],
            [
              { px: "101", sz: "1", n: 1 },
              { px: "102", sz: "2", n: 1 },
            ],
          ],
        },
      },
    });
  });

  it("emits stable market envelope for allMids", async () => {
    const subscriptions: Subscription[] = [];
    const subscriptionClient = makeWsClient(makeAllMidsHandler(subscriptions));

    const bucket = createBucket({ channel: "allMids" });

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach, () => bucket),
    );

    expect(upstream).toBeDefined();
    expect(typeof upstream.unsubscribe).toBe("function");
    expect(subscriptions).toEqual([{ type: "allMids" }]);
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

  it("releases the upstream subscription without resurrecting a bucket closed after open", async () => {
    const started = Deferred.makeUnsafe<void>();
    const unsubscribed: string[] = [];
    let subscribeCalls = 0;
    let transportClosed = false;

    const subscriptionClient = makeWsClient((subscription) => {
      subscribeCalls++;
      Deferred.doneUnsafe(started, Effect.void);
      return makeHandle(subscription, async () => {
        unsubscribed.push("allMids");
      });
    });

    const captured: { buckets: Ref.Ref<Map<string, Bucket>> | undefined } = {
      buckets: undefined,
    };

    const hubLayer = makeMarketStreamHubLayer(stubProvider, {
      createClient: () => ({
        wsClient: subscriptionClient,
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

      yield* Effect.sleep("20 millis");

      const map = yield* Ref.get(buckets);
      expect(subscribeCalls).toBe(1);
      expect(map.has("allMids:")).toBe(false);
      // The closed bucket releases its upstream instead of leaving it attached.
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
  const l2BookListeners: ((event: unknown) => void)[] = [];
  const l2BookSubscriptions: Subscription[] = [];
  const captured: { buckets: Ref.Ref<Map<string, Bucket>> | undefined } = { buckets: undefined };

  const defaultLevels = {
    bids: [
      { px: "100", sz: "1", n: 1 },
      { px: "99", sz: "2", n: 1 },
      { px: "98", sz: "3", n: 1 },
    ],
    asks: [
      { px: "101", sz: "1", n: 1 },
      { px: "102", sz: "2", n: 1 },
      { px: "103", sz: "3", n: 1 },
    ],
  };

  const subscriptionClient = makeWsClient((subscription, onData) => {
    if (subscription.type === "candle") {
      onData({ t: 1, T: 2, s: "BTC", i: "1m", o: "1", c: "1", h: "2", l: "0", v: "3", n: 1 });
      return makeHandle(subscription, async () => {
        unsubscribed.push("candle");
      });
    }
    if (subscription.type === "l2Book") {
      l2BookSubscriptions.push(subscription);
      l2BookListeners.push(onData);
      onData({
        coin: "ETH",
        time: 1,
        levels: [defaultLevels.bids, defaultLevels.asks],
      });
      return makeHandle(subscription, async () => {
        unsubscribed.push("l2Book");
      });
    }
    if (subscription.type === "allMids") {
      allMidsListeners.push(onData);
      onData({ data: { allMids: { BTC: "100" } } });
      return makeHandle(subscription, async () => {
        unsubscribed.push("allMids");
      });
    }
    throw new Error(`unexpected subscription: ${subscription.type}`);
  });

  const layer = makeMarketStreamHubLayer(makeTestProvider(), {
    createClient: () => ({ wsClient: subscriptionClient, close: () => {} }),
    onAcquire: (buckets) => {
      captured.buckets = buckets;
    },
  });

  return {
    layer,
    captured,
    unsubscribed,
    l2BookSubscriptions,
    emitAllMids: () => {
      for (const notify of allMidsListeners) {
        notify({ data: { allMids: { BTC: "101" } } });
      }
    },
    emitL2Book: (levels = defaultLevels) => {
      for (const notify of l2BookListeners) {
        notify({ coin: "ETH", time: 2, levels: [levels.bids, levels.asks] });
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

  it("sends the cached l2Book snapshot to a late joiner without a new upstream tick", async () => {
    const harness = makeTestHarness();
    const firstFrames: Record<string, unknown>[] = [];
    const lateFrames: Record<string, unknown>[] = [];
    const l2Book: MarketWsSubscription = {
      channel: "l2Book",
      symbol: "ETH",
      nSigFigs: 4,
      depth: 2,
    };

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const first = new StubSocket(hub.createConnectionData(), (text) => {
        firstFrames.push(parseTestFrame(text));
      });
      yield* hub.handleOpen(first);
      yield* sendSubscriptionFrame(hub, first, "subscribe", l2Book);
      yield* waitFor(() => countMarketFrames(firstFrames, "l2Book") > 0);

      const late = new StubSocket(hub.createConnectionData(), (text) => {
        lateFrames.push(parseTestFrame(text));
      });
      yield* hub.handleOpen(late);
      yield* sendSubscriptionFrame(hub, late, "subscribe", { ...l2Book, depth: 5 });

      expect(lateFrames.map((frame) => frame.type)).toEqual(["ready", "subscribed", "market"]);
      const snapshot = lateFrames[2];
      expect(snapshot).toMatchObject({
        type: "market",
        channel: "l2Book",
        data: {
          snapshot: {
            levels: [
              [
                { px: "100", sz: "1", n: 1 },
                { px: "99", sz: "2", n: 1 },
              ],
              [
                { px: "101", sz: "1", n: 1 },
                { px: "102", sz: "2", n: 1 },
              ],
            ],
          },
        },
      });
      expect(snapshot).not.toHaveProperty("data.delta");
      expect(harness.l2BookSubscriptions).toHaveLength(1);
    });

    await Effect.runPromise(Effect.provide(program, harness.layer));
  });

  it("broadcasts full l2Book snapshots and never delta frames", async () => {
    const harness = makeTestHarness();
    const frames: Record<string, unknown>[] = [];

    const program = Effect.gen(function* () {
      const hub = yield* MarketStreamHub;
      const ws = new StubSocket(hub.createConnectionData(), (text) => {
        frames.push(parseTestFrame(text));
      });

      yield* hub.handleOpen(ws);
      yield* sendSubscriptionFrame(hub, ws, "subscribe", {
        channel: "l2Book",
        symbol: "ETH",
        nSigFigs: 4,
      });
      yield* waitFor(() => countMarketFrames(frames, "l2Book") >= 1);

      harness.emitL2Book({
        bids: [{ px: "100", sz: "5", n: 1 }],
        asks: [{ px: "101", sz: "6", n: 1 }],
      });
      yield* waitFor(() => countMarketFrames(frames, "l2Book") >= 2);

      const books = frames.filter((frame) => frame.type === "market" && frame.channel === "l2Book");
      expect(books).toHaveLength(2);
      for (const frame of books) {
        expect(frame).toHaveProperty("data.snapshot");
        expect(frame).not.toHaveProperty("data.delta");
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

      expect([...harness.unsubscribed].toSorted()).toEqual(["allMids", "candle", "l2Book"]);
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
