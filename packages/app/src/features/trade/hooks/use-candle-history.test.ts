/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { ApiError } from "../../../lib/api-error";
import {
  HL_INFO_URL,
  jsonResponse as jsonResponseWithHeaders,
  market,
  stubFetch,
} from "../../../test/fixtures";
import { setCoinIndexLoader } from "../lib/hl-market-stream";
import { fetchByRange, fetchHistorical } from "./use-candle-history";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

const jsonResponse = (body: unknown, status: number, statusText: string): Response =>
  new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });

const respondWith = (body: unknown, status: number, statusText: string): typeof fetch =>
  Object.assign(() => Promise.resolve(jsonResponse(body, status, statusText)), {
    preconnect: (_url: string | URL) => {},
  });

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
    globalThis.fetch = respondWith([], 200, "OK");

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

describe("fetchHistorical fallback laziness", () => {
  test("a successful direct load issues no /candles/recent request", async () => {
    setCoinIndexLoader(() => Promise.resolve([market()]));
    try {
      const calls = stubFetch(() =>
        jsonResponseWithHeaders([
          {
            t: 1_700_000_000_000,
            T: 1_700_000_300_000,
            s: "BTC",
            i: "1h",
            o: "1",
            c: "2",
            h: "3",
            l: "0.5",
            v: "10",
            n: 3,
          },
        ]),
      );

      expect(await fetchHistorical("BTC", "1h", 200)).toHaveLength(1);
      expect(calls.filter((call) => call.url.startsWith(HL_INFO_URL))).toHaveLength(1);
      expect(calls.some((call) => call.url.includes("/candles/recent"))).toBe(false);
    } finally {
      setCoinIndexLoader(null);
    }
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
