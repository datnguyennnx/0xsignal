import { describe, expect, it } from "vitest";
import { Effect, Option, Scope } from "effect";
import type { ServerWebSocket } from "bun";
import { MarketStreamError } from "../../../../modules/market-data";
import type { Bucket, MarketWsConnectionData } from "../hub-types";
import { broadcast, MAX_CLIENT_BUFFER_BYTES, send, sendFrame } from "../hub-broadcast";

type FakeOptions = {
  readonly status?: number;
  readonly bufferedAmount?: number;
  readonly throwOnSend?: boolean;
};

type FakeSocket = {
  readonly socket: ServerWebSocket<MarketWsConnectionData>;
  readonly sent: string[];
  readonly closed: Array<{ code: number; reason: string }>;
};

const makeSocket = (options: FakeOptions = {}): FakeSocket => {
  const sent: string[] = [];
  const closed: Array<{ code: number; reason: string }> = [];
  const socket = {
    send(payload: string): number {
      sent.push(payload);
      if (options.throwOnSend === true) throw new Error("dead peer");
      return options.status ?? 1;
    },
    getBufferedAmount: (): number => options.bufferedAmount ?? 0,
    close(code: number, reason: string): void {
      closed.push({ code, reason });
    },
  };
  return {
    socket: socket as unknown as ServerWebSocket<MarketWsConnectionData>,
    sent,
    closed,
  };
};

const makeBucket = (clients: readonly ServerWebSocket<MarketWsConnectionData>[]): Bucket => ({
  key: "allMids:",
  subscription: { channel: "allMids" },
  clients: new Set(clients),
  upstream: Option.none(),
  state: { _tag: "idle" },
  lastSnapshot: { current: Option.none() },
  retryCount: 0,
  subscribeFiber: Option.none(),
  scope: Scope.makeUnsafe(),
});

const payload = { type: "market", channel: "allMids", data: { mids: { BTC: "100" } } };

describe("hub broadcast send status", () => {
  it("detaches a client whose send is dropped and does not count the frame", () => {
    const { socket } = makeSocket({ status: 0 });
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    const delivered = broadcast(makeBucket([socket]), payload, (ws) => detached.push(ws));

    expect(detached).toEqual([socket]);
    expect(delivered).toBe(0);
  });

  it("detaches a client whose send reports backpressure", () => {
    const { socket } = makeSocket({ status: -1 });
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    const delivered = broadcast(makeBucket([socket]), payload, (ws) => detached.push(ws));

    expect(detached).toEqual([socket]);
    expect(delivered).toBe(0);
  });

  it("keeps and counts a client whose send accepted the frame", () => {
    const { socket, sent } = makeSocket({ status: 12 });
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    const delivered = broadcast(makeBucket([socket]), payload, (ws) => detached.push(ws));

    expect(detached).toEqual([]);
    expect(delivered).toBe(1);
    expect(sent).toEqual([JSON.stringify(payload)]);
  });

  it("detaches an over-buffered client without sending", () => {
    const { socket, sent } = makeSocket({ bufferedAmount: MAX_CLIENT_BUFFER_BYTES + 1 });
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    const delivered = broadcast(makeBucket([socket]), payload, (ws) => detached.push(ws));

    expect(detached).toEqual([socket]);
    expect(delivered).toBe(0);
    expect(sent).toEqual([]);
  });

  it("detaches a client whose send throws", () => {
    const { socket } = makeSocket({ throwOnSend: true });
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    const delivered = broadcast(makeBucket([socket]), payload, (ws) => detached.push(ws));

    expect(detached).toEqual([socket]);
    expect(delivered).toBe(0);
  });
});

describe("send control frame status", () => {
  it("closes a socket whose control frame send is dropped", () => {
    const dropped = makeSocket({ status: 0 });

    send(dropped.socket, { type: "pong" });

    expect(dropped.sent).toEqual([JSON.stringify({ type: "pong" })]);
    expect(dropped.closed).toHaveLength(1);
  });

  it("closes a socket whose control frame send reports backpressure", () => {
    const backpressured = makeSocket({ status: -1 });

    send(backpressured.socket, { type: "pong" });

    expect(backpressured.sent).toEqual([JSON.stringify({ type: "pong" })]);
    expect(backpressured.closed).toHaveLength(1);
  });

  it("keeps a socket whose control frame send accepted the frame", () => {
    const healthy = makeSocket({ status: 1 });

    send(healthy.socket, { type: "pong" });

    expect(healthy.sent).toEqual([JSON.stringify({ type: "pong" })]);
    expect(healthy.closed).toEqual([]);
  });

  it("closes an over-buffered socket without sending the control frame", () => {
    const buffered = makeSocket({ bufferedAmount: MAX_CLIENT_BUFFER_BYTES + 1 });

    send(buffered.socket, { type: "pong" });

    expect(buffered.sent).toEqual([]);
    expect(buffered.closed).toHaveLength(1);
  });

  it("still propagates a thrown send to the caller", () => {
    const broken = makeSocket({ throwOnSend: true });

    expect(() => send(broken.socket, { type: "pong" })).toThrow("dead peer");
  });
});

describe("sendFrame send status", () => {
  it("uses the same detach path as broadcast for dropped frames", async () => {
    const dropped = makeSocket({ status: 0 });
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    await Effect.runPromise(sendFrame(dropped.socket, { type: "pong" }, (ws) => detached.push(ws)));

    expect(detached).toEqual([dropped.socket]);
    expect(dropped.sent).toEqual([JSON.stringify({ type: "pong" })]);
  });

  it("uses the same detach path for backpressure", async () => {
    const backpressured = makeSocket({ status: -1 });
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    await Effect.runPromise(
      sendFrame(backpressured.socket, { type: "pong" }, (ws) => detached.push(ws)),
    );

    expect(detached).toEqual([backpressured.socket]);
  });

  it("does not detach a healthy client", async () => {
    const healthy = makeSocket({ status: 5 });
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    await Effect.runPromise(sendFrame(healthy.socket, { type: "pong" }, (ws) => detached.push(ws)));

    expect(detached).toEqual([]);
  });

  it("detaches an over-buffered client without sending", async () => {
    const buffered = makeSocket({ bufferedAmount: MAX_CLIENT_BUFFER_BYTES + 1 });
    const detached: ServerWebSocket<MarketWsConnectionData>[] = [];

    await Effect.runPromise(
      sendFrame(buffered.socket, { type: "pong" }, (ws) => detached.push(ws)),
    );

    expect(detached).toEqual([buffered.socket]);
    expect(buffered.sent).toEqual([]);
  });

  it("still surfaces a thrown send as a typed error", async () => {
    const broken = makeSocket({ throwOnSend: true });

    const error = await Effect.runPromise(
      sendFrame(broken.socket, { type: "pong" }).pipe(Effect.flip),
    );

    expect(error).toBeInstanceOf(MarketStreamError);
    expect(error.code).toBe("SEND_FAILED");
  });
});
