/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { ApiError } from "../../lib/api-error";
import { getMarketPrice } from "./market";

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

describe("getMarketPrice", () => {
  test("maps a successful ticker into a MarketPrice", async () => {
    globalThis.fetch = respondWith(
      {
        symbol: "BTC",
        markPx: "100",
        midPx: "99",
        prevDayPx: "90",
        dayNtlVlm: "1000",
        openInterest: "5",
        funding: "0.01",
      },
      200,
      "OK",
    );

    const price = await getMarketPrice("BTC");

    expect(price.symbol).toBe("BTC");
    expect(price.markPx).toBe(100);
    expect(price.midPx).toBe(99);
    expect(price.price).toBe(100);
    expect(price.volume24h).toBe(1000);
  });

  test("rejects with the API error instead of fabricating zero prices", async () => {
    globalThis.fetch = respondWith({ error: "upstream unavailable" }, 502, "Bad Gateway");

    const error = await capture(getMarketPrice("BTC"));

    expect(error instanceof ApiError).toBe(true);
    expect(statusOf(error)).toBe(502);
  });
});
