/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { ApiError } from "../../../lib/api-error";
import { fetchByRange, fetchHistorical } from "./use-candle-history";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

const jsonResponse = (body: unknown, status: number, statusText: string): Response =>
  new Response(JSON.stringify(body), { status, statusText });

const respondWith = (body: unknown, status: number, statusText: string): typeof fetch => {
  return () => Promise.resolve(jsonResponse(body, status, statusText));
};

const capture = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error;
  }
};

const statusOf = (error: unknown): number | undefined =>
  error instanceof ApiError ? error.status : undefined;

describe("fetchHistorical", () => {
  test("resolves to an empty array for a genuinely empty window", async () => {
    globalThis.fetch = respondWith({ candles: [] }, 200, "OK");

    expect(await fetchHistorical("BTC", "1h", 200)).toEqual([]);
  });

  test("rejects on failure so the chart can tell it apart from an empty window", async () => {
    globalThis.fetch = respondWith(
      { error: "candle store unavailable" },
      503,
      "Service Unavailable",
    );

    const error = await capture(fetchHistorical("BTC", "1h", 200));

    expect(error instanceof ApiError).toBe(true);
    expect(statusOf(error)).toBe(503);
  });
});

describe("fetchByRange", () => {
  test("rejects on failure instead of resolving to an empty page", async () => {
    globalThis.fetch = respondWith({ error: "boom" }, 500, "Internal Server Error");

    const error = await capture(fetchByRange("BTC", "1h", 0, 1));

    expect(error instanceof ApiError).toBe(true);
    expect(statusOf(error)).toBe(500);
  });
});
