import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import type { Server, ServerWebSocket } from "bun";
import { asHttpError } from "../error-response";
import { createConnectionCap, createFetchHandler } from "../fetch-handler";
import {
  capWsHandlers,
  MAX_WS_CONNECTIONS,
  MAX_WS_PAYLOAD_BYTES,
  toBunWebSocketHandler,
  WS_BACKPRESSURE_LIMIT_BYTES,
  WS_SERVE_OPTIONS,
} from "../server";
import type { WsSetup } from "../ws";

type Data = { readonly id: string };

const cors = {
  headers: { "access-control-allow-origin": "*" },
  preflight: new Response(null, { status: 204 }),
  applyTo: (headers: Headers) => headers,
};

const noopHandlers = {
  open: () => {},
  message: () => {},
  pong: () => {},
  close: () => {},
};

const makeWs = (upgrade: WsSetup<Data>["upgrade"]): WsSetup<Data> => ({
  path: "/api/ws/market",
  idleTimeoutSeconds: 1,
  upgrade,
  handlers: noopHandlers,
});

const makeFetchHandler = (
  upgrade: WsSetup<Data>["upgrade"],
  cap?: ReturnType<typeof createConnectionCap>,
) =>
  createFetchHandler(
    (effect) => Effect.runPromise(effect),
    cors,
    makeWs(upgrade),
    () => asHttpError(500, "unexpected"),
    () => Effect.succeed(new Response("ok")),
    cap,
  );

describe("websocket transport limits", () => {
  it("exports the Bun websocket options as named values", () => {
    expect(WS_SERVE_OPTIONS).toEqual({
      maxPayloadLength: MAX_WS_PAYLOAD_BYTES,
      backpressureLimit: WS_BACKPRESSURE_LIMIT_BYTES,
      closeOnBackpressureLimit: true,
    });
    expect(MAX_WS_PAYLOAD_BYTES).toBe(1024 * 1024);
    expect(WS_BACKPRESSURE_LIMIT_BYTES).toBe(1024 * 1024);
    expect(MAX_WS_CONNECTIONS).toBe(1024);
  });

  it("accepts N connections and rejects the N+1th", () => {
    const cap = createConnectionCap(2);

    expect(cap.tryAcquire()).toBe(true);
    expect(cap.tryAcquire()).toBe(true);
    expect(cap.tryAcquire()).toBe(false);
    expect(cap.active()).toBe(2);

    cap.release();
    expect(cap.active()).toBe(1);
    expect(cap.tryAcquire()).toBe(true);
  });

  it("rejects an excess upgrade before Bun sees the socket", async () => {
    const cap = createConnectionCap(1);
    expect(cap.tryAcquire()).toBe(true);
    const upgrade = vi.fn(() => undefined);
    const fetchHandler = makeFetchHandler(upgrade, cap);

    const response = await fetchHandler(
      new Request("http://localhost/api/ws/market"),
      {} as Server<Data>,
    );

    expect(response?.status).toBe(503);
    expect(upgrade).not.toHaveBeenCalled();
    expect(cap.active()).toBe(1);
  });

  it("releases the slot when the upgrade itself fails", async () => {
    const cap = createConnectionCap(1);
    const upgrade = vi.fn(() => new Response("bad", { status: 400 }));
    const fetchHandler = makeFetchHandler(upgrade, cap);

    const response = await fetchHandler(
      new Request("http://localhost/api/ws/market"),
      {} as Server<Data>,
    );

    expect(response?.status).toBe(400);
    expect(cap.active()).toBe(0);
  });

  it("releases a capped socket exactly once across error and close", () => {
    const cap = createConnectionCap(1);
    expect(cap.tryAcquire()).toBe(true);
    let errored = 0;
    let closed = 0;
    const handlers = capWsHandlers(
      {
        ...noopHandlers,
        error: () => {
          errored += 1;
        },
        close: () => {
          closed += 1;
        },
      },
      cap,
    );
    const ws = {} as ServerWebSocket<Data>;

    handlers.error?.(ws, new Error("socket failed"));
    handlers.close(ws);

    expect(errored).toBe(1);
    expect(closed).toBe(1);
    expect(cap.active()).toBe(0);
  });

  it("adapts Bun's error(error, ws) order to the module's error(ws, error)", () => {
    const ws = {} as ServerWebSocket<Data>;
    const failure = new Error("boom");
    const seen: unknown[][] = [];
    const bun = toBunWebSocketHandler({
      ...noopHandlers,
      error: (socket, error) => {
        seen.push([socket, error]);
      },
    });

    bun.error?.(failure, ws);

    expect(seen).toEqual([[ws, failure]]);
  });
});
