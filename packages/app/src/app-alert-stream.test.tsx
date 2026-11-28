/// <reference types="bun-types" />
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

import "../test/setup";
import { cleanup, renderDom } from "../test/render";
import { AlertStreamMount } from "./App";

const realError = console.error;
console.error = () => {};
afterAll(() => {
  console.error = realError;
  cleanup();
});
afterEach(cleanup);

/** The hook opens a socket on mount; the guard test counts mounts instead of dialing. */
class FakeWebSocket {
  static readonly opened: FakeWebSocket[] = [];

  constructor(readonly url: string) {
    FakeWebSocket.opened.push(this);
  }

  addEventListener(): void {}
  close(): void {}
}

const realWebSocket = globalThis.WebSocket;

beforeAll(() => {
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: FakeWebSocket,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: realWebSocket,
  });
});

describe("AlertStreamMount", () => {
  test("throws outside a QueryClientProvider", () => {
    expect(() => renderDom(createElement(AlertStreamMount))).toThrow(/No QueryClient set/);
    expect(FakeWebSocket.opened).toHaveLength(0);
  });

  test("renders and opens one stream inside a QueryClientProvider", () => {
    FakeWebSocket.opened.length = 0;
    const client = new QueryClient();

    const view = renderDom(
      createElement(QueryClientProvider, { client }, createElement(AlertStreamMount)),
    );

    expect(view.container.innerHTML).toBe("");
    expect(FakeWebSocket.opened).toHaveLength(1);
  });
});
