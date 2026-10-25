/// <reference types="bun-types" />
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from "bun:test";

import type { WsMarketSubscription } from "@0xsignal/shared";

import {
  createMarketStreamClient,
  type MarketStreamClient,
  type MarketStreamMeta,
} from "./market-stream-client";

interface Frame {
  readonly type: "subscribe" | "unsubscribe";
  readonly subscription: WsMarketSubscription;
}

const isFrame = (value: unknown): value is Frame => {
  if (typeof value !== "object" || value === null) return false;
  if (!("type" in value) || !("subscription" in value)) return false;
  return value.type === "subscribe" || value.type === "unsubscribe";
};

let sockets: FakeWebSocket[] = [];
let log: string[] = [];

/** Test double: the client only touches readyState, send, close and listeners. */
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: Frame[] = [];
  closeCalled = false;

  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {
    sockets.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  send(raw: string): void {
    const frame: unknown = JSON.parse(raw);
    if (!isFrame(frame)) throw new Error(`Unexpected subscription frame: ${raw}`);
    this.sent.push(frame);
    log.push(`send:${frame.type}:${frame.subscription.channel}`);
  }

  close(): void {
    this.closeCalled = true;
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }

  disconnect(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  message(payload: unknown): void {
    this.emit("message", { data: JSON.stringify(payload) });
  }

  private emit(type: string, event?: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const nativeWebSocket = globalThis.WebSocket;

beforeAll(() => {
  Object.defineProperty(globalThis, "WebSocket", {
    value: FakeWebSocket,
    configurable: true,
    writable: true,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, "WebSocket", {
    value: nativeWebSocket,
    configurable: true,
    writable: true,
  });
});

type Callbacks = Parameters<MarketStreamClient["subscribe"]>[1];
type Subscription = Awaited<ReturnType<MarketStreamClient["subscribe"]>>;

let subscriptions: Subscription[] = [];

const subscribe = async (
  client: MarketStreamClient,
  subscription: WsMarketSubscription,
  callbacks: Callbacks,
): Promise<Subscription> => {
  const active = await client.subscribe(subscription, callbacks);
  subscriptions.push(active);
  return active;
};

const makeCallbacks = (label: string) => {
  const received: { data: unknown; channel: string; meta?: MarketStreamMeta }[] = [];
  const callbacks: Callbacks = {
    onMessage: (data, channel, meta) => {
      received.push(meta === undefined ? { data, channel } : { data, channel, meta });
    },
    onConnectionChange: (connected) => {
      log.push(`${label}:connected:${connected}`);
    },
    onError: (error) => {
      log.push(`${label}:error:${error.message}`);
    },
    onReconnect: () => {
      log.push(`${label}:reconnect`);
    },
  };
  return { received, callbacks };
};

beforeEach(() => {
  sockets = [];
  log = [];
});

afterEach(() => {
  for (const subscription of subscriptions) subscription.unsubscribe();
  subscriptions = [];
  jest.useRealTimers();
});

describe("market-stream-client subscription identity", () => {
  test("normalizes candle identity and subscribes once for duplicate acquires", async () => {
    const client = createMarketStreamClient();
    const first = makeCallbacks("first");
    const second = makeCallbacks("second");

    await subscribe(
      client,
      { channel: "candle", symbol: " btcusdt ", interval: "15m" },
      first.callbacks,
    );
    await subscribe(
      client,
      { channel: "candle", symbol: "btc", interval: "15m" },
      second.callbacks,
    );

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.sent).toEqual([]);

    sockets[0]?.open();

    expect(sockets[0]?.sent).toEqual([
      {
        type: "subscribe",
        subscription: { channel: "candle", symbol: "BTC", interval: "15m" },
      },
    ]);
  });

  test("keeps l2Book depth variants distinct and closes after the last release", async () => {
    const client = createMarketStreamClient();
    const five = makeCallbacks("five");
    const three = makeCallbacks("three");

    const depthFive = await subscribe(
      client,
      { channel: "l2Book", symbol: "ETH", nSigFigs: 5 },
      five.callbacks,
    );
    await subscribe(client, { channel: "l2Book", symbol: "ETH", nSigFigs: 3 }, three.callbacks);

    sockets[0]?.open();

    expect(sockets[0]?.sent.map((frame) => frame.subscription)).toEqual([
      { channel: "l2Book", symbol: "ETH", nSigFigs: 5 },
      { channel: "l2Book", symbol: "ETH", nSigFigs: 3 },
    ]);

    depthFive.unsubscribe();

    expect(sockets[0]?.sent.at(-1)).toEqual({
      type: "unsubscribe",
      subscription: { channel: "l2Book", symbol: "ETH", nSigFigs: 5 },
    });
    expect(sockets[0]?.closeCalled).toBe(false);
  });

  test("does not subscribe twice when a duplicate acquire lands after open", async () => {
    const client = createMarketStreamClient();
    const first = makeCallbacks("first");
    const second = makeCallbacks("second");

    const firstSubscription = await subscribe(
      client,
      { channel: "candle", symbol: "BTC", interval: "1m" },
      first.callbacks,
    );
    sockets[0]?.open();
    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, second.callbacks);

    expect(sockets[0]?.sent).toHaveLength(1);

    firstSubscription.unsubscribe();

    expect(sockets[0]?.sent).toHaveLength(1);
    expect(sockets[0]?.closeCalled).toBe(false);
  });
});

describe("market-stream-client routing", () => {
  test("routes candle frames by coin and interval and l2Book frames by depth", async () => {
    const client = createMarketStreamClient();
    const btc = makeCallbacks("btc");
    const eth = makeCallbacks("eth");
    const depthFive = makeCallbacks("depth-five");
    const depthThree = makeCallbacks("depth-three");

    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, btc.callbacks);
    await subscribe(client, { channel: "candle", symbol: "ETH", interval: "1m" }, eth.callbacks);
    await subscribe(client, { channel: "l2Book", symbol: "BTC", nSigFigs: 5 }, depthFive.callbacks);
    await subscribe(
      client,
      { channel: "l2Book", symbol: "BTC", nSigFigs: 3 },
      depthThree.callbacks,
    );

    sockets[0]?.open();

    sockets[0]?.message({
      channel: "candle",
      coin: "BTC",
      interval: "1m",
      data: { candles: [{ t: 1_700_000_000, o: "100", h: "110", l: "90", c: "105", v: "12.5" }] },
    });

    expect(btc.received).toEqual([
      {
        channel: "candle",
        data: [{ time: 1_700_000_000, open: 100, high: 110, low: 90, close: 105, volume: 12.5 }],
        meta: { coin: "BTC", interval: "1m" },
      },
    ]);
    expect(eth.received).toEqual([]);
    expect(depthFive.received).toEqual([]);
    expect(depthThree.received).toEqual([]);

    sockets[0]?.message({ channel: "l2Book", data: { levels: [[], []], nSigFigs: 5 } });

    expect(depthFive.received).toHaveLength(1);
    expect(depthThree.received).toEqual([]);
  });
});

describe("market-stream-client reconnect", () => {
  test("re-subscribes every active subscription before reconnect callbacks run", async () => {
    jest.useFakeTimers();

    const client = createMarketStreamClient();
    const candle = makeCallbacks("candle");
    const mids = makeCallbacks("allMids");

    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, candle.callbacks);
    await subscribe(client, { channel: "allMids" }, mids.callbacks);

    const first = sockets[0];
    first?.open();

    first?.disconnect();
    jest.advanceTimersByTime(1000);

    expect(sockets).toHaveLength(2);
    const second = sockets[1];
    expect(second?.sent).toEqual([]);

    second?.open();

    expect(second?.sent).toEqual([
      { type: "subscribe", subscription: { channel: "candle", symbol: "BTC", interval: "1m" } },
      { type: "subscribe", subscription: { channel: "allMids" } },
    ]);

    const reconnectStart = log.indexOf("candle:connected:false");
    expect(log.slice(reconnectStart)).toEqual([
      "candle:connected:false",
      "allMids:connected:false",
      "send:subscribe:candle",
      "send:subscribe:allMids",
      "candle:connected:true",
      "allMids:connected:true",
      "candle:reconnect",
      "allMids:reconnect",
    ]);
  });
});
