/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { queryKeys } from "@/lib/query-keys";

import {
  markUserDataWsWrite,
  resolveUserDataRestResult,
  USER_REST_FALLBACK_MS,
  userRestRefetchInterval,
} from "./user-query-race";

const ADDRESS = "0x0000000000000000000000000000000000000001";
const realDateNow = Date.now;
let nowMs = 0;

const installDocument = (visibilityState: DocumentVisibilityState): void => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { visibilityState },
  });
};

beforeEach(() => {
  nowMs = 1_000_000;
  Date.now = () => nowMs;
});

afterEach(() => {
  Date.now = realDateNow;
  Reflect.deleteProperty(globalThis, "document");
});

const restState = { time: 1_000 };
const wsState = { time: 1_001 };

describe("user data REST/WS race guard", () => {
  test("a WS frame landing during an in-flight REST read discards the REST response", async () => {
    const key = queryKeys.user.clearinghouseState(ADDRESS);
    let resolveResponse!: (value: typeof restState) => void;
    const response = new Promise<typeof restState>((resolve) => {
      resolveResponse = resolve;
    });

    const startedAt = Date.now();
    let cached: typeof restState | undefined = undefined;
    const request = (async () => {
      const data = await response;
      return resolveUserDataRestResult(key, startedAt, data, () => cached);
    })();

    // The newer WS frame lands while the request is still in flight.
    nowMs += 1;
    cached = wsState;
    markUserDataWsWrite(key);
    resolveResponse(restState);

    expect(await request).toBe(wsState);
  });

  test("a REST read with no newer WS frame is kept", async () => {
    const key = queryKeys.user.openOrders(ADDRESS);

    const startedAt = Date.now();
    const result = resolveUserDataRestResult(key, startedAt, restState, () => wsState);

    expect(result).toBe(restState);
  });

  test("a WS frame older than the request does not block the REST read", () => {
    const key = queryKeys.user.fills(ADDRESS);
    markUserDataWsWrite(key);
    nowMs += 1;
    const startedAt = Date.now();

    const result = resolveUserDataRestResult(key, startedAt, restState, () => wsState);

    expect(result).toBe(restState);
  });

  test("the cache wins only when it exists, otherwise the response is used", () => {
    const key = queryKeys.user.spotClearinghouseState(ADDRESS);
    const startedAt = Date.now();
    nowMs += 1;
    markUserDataWsWrite(key);

    expect(resolveUserDataRestResult(key, startedAt, restState, () => undefined)).toBe(restState);
  });
});

describe("user data REST fallback interval", () => {
  test("polls every 30s while the stream is not live and the tab is visible", () => {
    installDocument("visible");

    expect(userRestRefetchInterval(false)).toBe(USER_REST_FALLBACK_MS);
    expect(USER_REST_FALLBACK_MS).toBe(30_000);
  });

  test("stops polling while the stream is live", () => {
    installDocument("visible");

    expect(userRestRefetchInterval(true)).toBe(false);
  });

  test("stops polling while the tab is hidden", () => {
    installDocument("hidden");

    expect(userRestRefetchInterval(false)).toBe(false);
    expect(userRestRefetchInterval(true)).toBe(false);
  });
});
