import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { ServerWebSocket, WebSocketReadyState } from "bun";
import { asHttpError } from "../../../platform/http/error-response";
import { createWsEventHandlers } from "../ws";
import type { SocketConnection } from "../../../platform/http/ws";
import type { RunSocketWork } from "../../../platform/http/ws";

type Data = { readonly id: string };

type HandlerSocket = ServerWebSocket<Data>;
type SendArg = Parameters<HandlerSocket["send"]>[0];
type SendBinaryArg = Parameters<HandlerSocket["sendBinary"]>[0];
type SendStatus = ReturnType<HandlerSocket["send"]>;
type PingArg = Parameters<HandlerSocket["ping"]>[0];

class StubSocket implements ServerWebSocket<Data> {
  readonly subscriptions: string[] = [];
  readonly remoteAddress = "127.0.0.1";
  readonly readyState: WebSocketReadyState = 1;
  binaryType?: "nodebuffer" | "arraybuffer" | "uint8array" | "blob";
  terminated = false;
  pings = 0;
  private paused = false;

  constructor(readonly data: Data) {}

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
  cork<R = unknown>(_callback: (ws: HandlerSocket) => R): R {
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
});
