import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { cast } from "../core/parse";
import type { Subscription } from "./types";
import type { WsStatus } from "./client";
import { WsClient } from "./client";

let sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  readonly #listeners = new Map<string, Set<(event: { data?: unknown }) => void>>();

  readonly url: string;

  constructor(url: string) {
    this.url = url;
    sockets.push(this);
  }

  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.#emit("close");
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.#emit("open");
  }

  message(payload: unknown): void {
    this.#emit("message", { data: JSON.stringify(payload) });
  }

  #emit(type: string, event?: { data?: unknown }): void {
    for (const listener of this.#listeners.get(type) ?? []) listener(event ?? {});
  }
}

const FakeSocketImpl = cast<typeof WebSocket>(FakeWebSocket, "webSocketImpl");

const noop = (): void => {};

const socketOf = (): FakeWebSocket => {
  const [socket] = sockets;
  if (socket === undefined) throw new Error("no websocket was created");
  return socket;
};

const latestSocket = (): FakeWebSocket => {
  const socket = sockets.at(-1);
  if (socket === undefined) throw new Error("no websocket was created");
  return socket;
};

const settle = async (turns = 8): Promise<void> => {
  if (turns <= 0) return;
  await Promise.resolve();
  return settle(turns - 1);
};

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.catch((error: unknown) => error);

const withDeadline = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`promise did not settle within ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
};

const snapshot = (coin: string): unknown => ({
  coin,
  levels: [[], []],
  time: 1,
  isSnapshot: true,
});

const btc: Subscription = { type: "l2Book", coin: "BTC" };
const eth: Subscription = { type: "l2Book", coin: "ETH" };

const keyOf = (subscription: Subscription): string => JSON.stringify(subscription);

const methodsSent = (socket: FakeWebSocket): unknown[] =>
  socket.sent.map((frame) => {
    const parsed: unknown = JSON.parse(frame);
    if (typeof parsed !== "object" || parsed === null) return null;
    return cast<{ method?: unknown }>(parsed, "sent").method;
  });

const connect = (shouldReconnect: boolean): WsClient => {
  const client = new WsClient({ webSocketImpl: FakeSocketImpl, shouldReconnect });
  socketOf().open();
  return client;
};

beforeEach(() => {
  sockets = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe("per-subscription subscription errors", () => {
  test("a timed-out ack reports to that handle and the global listener, then drops the entry", async () => {
    jest.useFakeTimers();
    const client = connect(false);
    const btcErrors: unknown[] = [];
    const ethErrors: unknown[] = [];
    const btcData: unknown[] = [];
    const ethData: unknown[] = [];
    const globalErrors: unknown[] = [];
    client.onError((error) => {
      globalErrors.push(error);
    });

    const btcHandle = client.subscribe(
      btc,
      (data) => {
        btcData.push(data);
      },
      {
        onError: (error) => {
          btcErrors.push(error);
        },
      },
    );
    client.subscribe(
      eth,
      (data) => {
        ethData.push(data);
      },
      {
        onError: (error) => {
          ethErrors.push(error);
        },
      },
    );

    const socket = socketOf();
    socket.message({ channel: "l2Book", data: snapshot("BTC") });
    socket.message({ channel: "l2Book", data: snapshot("ETH") });
    socket.message({
      channel: "subscriptionResponse",
      data: { method: "subscribe", subscription: eth },
    });
    await settle();
    expect(client.hasSnapshot(keyOf(btc))).toBe(true);
    expect(client.hasSnapshot(keyOf(eth))).toBe(true);
    expect(btcData).toHaveLength(1);

    jest.advanceTimersByTime(30_000);
    await settle();

    expect(btcErrors).toHaveLength(1);
    expect(ethErrors).toHaveLength(0);
    expect(globalErrors).toHaveLength(1);
    expect(globalErrors[0]).toBe(btcErrors[0]);
    expect(client.hasSnapshot(keyOf(btc))).toBe(false);
    expect(client.hasSnapshot(keyOf(eth))).toBe(true);

    socket.message({ channel: "l2Book", data: { coin: "BTC", levels: [[], []], time: 2 } });
    socket.message({ channel: "l2Book", data: { coin: "ETH", levels: [[], []], time: 2 } });
    await settle();

    expect(btcData).toHaveLength(1);
    expect(ethData).toHaveLength(2);
    expect(btcHandle.subscription).toEqual(btc);
    client.close();
  });
});

describe("reconnect", () => {
  test("reconnects synchronously, reopening the status without a backoff delay", () => {
    const client = connect(true);
    const statuses: WsStatus[] = [];
    client.onStatus((status) => {
      statuses.push(status);
    });
    expect(client.status).toBe("open");

    const startedAt = Date.now();
    client.reconnect();

    expect(sockets).toHaveLength(2);
    expect(client.status).toBe("connecting");
    latestSocket().open();
    expect(client.status).toBe("open");
    expect(statuses).toEqual(["connecting", "open"]);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const before = sockets.length;
      client.reconnect();
      expect(sockets).toHaveLength(before + 1);
      latestSocket().open();
      expect(client.status).toBe("open");
    }

    expect(Date.now() - startedAt).toBeLessThan(100);
    expect(statuses).not.toContain("reconnecting");
    client.close();
  });
});

describe("terminationSignal", () => {
  test("reconnect leaves the signal live and close aborts it once with WsClosed", () => {
    const client = connect(false);
    const signal = client.terminationSignal;
    let aborts = 0;
    const reasons: unknown[] = [];
    signal.addEventListener("abort", () => {
      aborts += 1;
      reasons.push(signal.reason);
    });

    client.reconnect();
    latestSocket().open();
    expect(signal.aborted).toBe(false);
    expect(aborts).toBe(0);

    client.close();
    expect(signal.aborted).toBe(true);
    expect(aborts).toBe(1);

    const reason: unknown = signal.reason;
    expect(reason).toBeInstanceOf(Error);
    const error = cast<Error>(reason, "abort reason");
    expect(error.name).toBe("WsClosed");
    expect(reasons).toEqual([reason]);

    client.close();
    expect(aborts).toBe(1);
  });
});

describe("unsubscribeAsync", () => {
  test("resolves after the unsubscribe frame is written", async () => {
    const client = connect(false);
    const handle = client.subscribe(btc, noop);
    const socket = socketOf();
    expect(methodsSent(socket)).toEqual(["subscribe"]);

    await withDeadline(handle.unsubscribeAsync(), 1000);

    expect(methodsSent(socket)).toEqual(["subscribe", "unsubscribe"]);
    expect(client.hasSnapshot(keyOf(btc))).toBe(false);
    client.close();
  });

  test("resolves immediately when the socket is not open", async () => {
    const client = new WsClient({ webSocketImpl: FakeSocketImpl, shouldReconnect: false });
    const handle = client.subscribe(btc, noop);

    const outcome: unknown = await rejectionOf(withDeadline(handle.unsubscribeAsync(), 1000));
    expect(outcome).toBeUndefined();

    expect(socketOf().sent).toEqual([]);
    client.close();
  });

  test("never rejects for an already unsubscribed handle", async () => {
    const client = connect(false);
    const handle = client.subscribe(btc, noop);
    handle.unsubscribe();

    const outcome = await rejectionOf(withDeadline(handle.unsubscribeAsync(), 1000));

    expect(outcome).toBeUndefined();
    client.close();
  });
});
