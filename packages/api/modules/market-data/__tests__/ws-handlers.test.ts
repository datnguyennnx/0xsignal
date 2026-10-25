import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { ServerWebSocket, ServerWebSocketSendStatus, WebSocketReadyState } from "bun";
import { asHttpError } from "../../../platform/http/error-response";
import { createWsEventHandlers } from "../ws";
import type { SocketConnection } from "../../../platform/http/ws";
import type { RunSocketWork } from "../../../platform/http/ws";

type Data = { readonly id: string };

class StubSocket implements ServerWebSocket<Data> {
  readonly subscriptions: string[] = [];
  readonly remoteAddress = "127.0.0.1";
  readonly readyState: WebSocketReadyState = 1;
  terminated = false;
  pings = 0;

  constructor(readonly data: Data) {}

  send(): ServerWebSocketSendStatus {
    return 0;
  }
  sendText(): ServerWebSocketSendStatus {
    return 0;
  }
  sendBinary(): ServerWebSocketSendStatus {
    return 0;
  }
  close(): void {}
  terminate(): void {
    this.terminated = true;
  }
  ping(): ServerWebSocketSendStatus {
    this.pings += 1;
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
