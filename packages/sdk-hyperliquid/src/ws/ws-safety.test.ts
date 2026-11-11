import { beforeEach, describe, expect, test } from "bun:test";
import { ValidationError } from "../core/errors";
import { cast } from "../core/parse";
import type { Subscription } from "./types";
import { WsClient } from "./client";
import { decodeFastAssetCtxs } from "./deflate";

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

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 0);
  });

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.catch((error: unknown) => error);

const snapshot = (coin: string): unknown => ({
  coin,
  levels: [[], []],
  time: 1,
  isSnapshot: true,
});

const btc: Subscription = { type: "l2Book", coin: "BTC" };
const eth: Subscription = { type: "l2Book", coin: "ETH" };

const keyOf = (subscription: Subscription): string => JSON.stringify(subscription);

const connect = (): WsClient => {
  const client = new WsClient({ webSocketImpl: FakeSocketImpl, shouldReconnect: false });
  socketOf().open();
  return client;
};

beforeEach(() => {
  sockets = [];
});

describe("snapshot pruning", () => {
  test("unsubscribing one key retains the other key's snapshot", async () => {
    const client = connect();
    const btcHandle = client.subscribe(btc, noop);
    client.subscribe(eth, noop);
    const socket = socketOf();
    socket.message({ channel: "l2Book", data: snapshot("BTC") });
    socket.message({ channel: "l2Book", data: snapshot("ETH") });
    await flush();
    expect(client.hasSnapshot(keyOf(btc))).toBe(true);
    expect(client.hasSnapshot(keyOf(eth))).toBe(true);

    btcHandle.unsubscribe();

    expect(client.hasSnapshot(keyOf(btc))).toBe(false);
    expect(client.hasSnapshot(keyOf(eth))).toBe(true);
    client.close();
  });

  test("closing clears every retained snapshot", async () => {
    const client = connect();
    client.subscribe(btc, noop);
    client.subscribe(eth, noop);
    const socket = socketOf();
    socket.message({ channel: "l2Book", data: snapshot("BTC") });
    socket.message({ channel: "l2Book", data: snapshot("ETH") });
    await flush();
    expect(client.hasSnapshot(keyOf(btc))).toBe(true);
    expect(client.hasSnapshot(keyOf(eth))).toBe(true);

    client.close();

    expect(client.hasSnapshot(keyOf(btc))).toBe(false);
    expect(client.hasSnapshot(keyOf(eth))).toBe(false);
  });
});

const concat = (chunks: readonly Uint8Array[]): Uint8Array => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

const drain = async (reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Uint8Array[]> => {
  const result = await reader.read();
  if (result.done) return [];
  return [result.value, ...(await drain(reader))];
};

const deflateRaw = async (input: Uint8Array): Promise<Uint8Array> => {
  const stream = new CompressionStream("deflate-raw");
  const reader = stream.readable.getReader();
  const writer = stream.writable.getWriter();
  const drained = drain(reader);
  await writer.write(new Uint8Array(input));
  await writer.close();
  return concat(await drained);
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary);
};

const VECTOR =
  "q1ZyCnFWsqpWyk0syg6oULJSsjQ3NTDQM1Wq1VFyDfFAkTI2MzXQMwJLVVRWWfmFuTiiyBuamOoZKdXWAgA=";

describe("fastAssetCtxs decompression cap", () => {
  test("an inflated payload beyond 8 MiB throws ValidationError", async () => {
    const json = `{"BTC":{"markPx":1}}${" ".repeat(8 * 1024 * 1024 + 1)}`;
    const inflated = new TextEncoder().encode(json);
    const encoded = toBase64(await deflateRaw(inflated));

    expect(await rejectionOf(decodeFastAssetCtxs(encoded))).toBeInstanceOf(ValidationError);
  });

  test("the documented small vector still decodes", async () => {
    const decoded = await decodeFastAssetCtxs(VECTOR);
    expect(decoded).toEqual({
      BTC: { markPx: 97500.5 },
      ETH: { markPx: 3650.25 },
      "xyz:NVDA": { markPx: 145.2 },
    });
  });
});
