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

describe("getMarketPrice", () => {
  test("maps a full ticker into a MarketPrice without substitution", async () => {
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
    expect(price.price).toBe(100);
    expect(price.markPx).toBe(100);
    expect(price.midPx).toBe(99);
    expect(price.prevDayPx).toBe(90);
    expect(price.change24h).toBeCloseTo(11.1111, 3);
    expect(price.volume24h).toBe(1000);
    expect(price.openInterest).toBe(5);
    expect(price.funding).toBe(0.01);
    expect(price.quote).not.toBeNull();
    expect(price.quote?.price).toBe(100);
    expect(price.quote?.markPx).toBe(100);
    expect(price.quote?.midPx).toBe(99);
    expect(price.quote?.prevDayPx).toBe(90);
    expect(price.quote?.change24h).toBeCloseTo(11.1111, 3);
    expect(price.quote?.volume24h).toBe(1000);
    expect(price.quote?.openInterest).toBe(5);
    expect(price.quote?.funding).toBe(0.01);
  });

  test("leaves a missing prevDayPx null instead of mirroring the mark", async () => {
    globalThis.fetch = respondWith(
      { symbol: "BTC", markPx: "100", midPx: "99", dayNtlVlm: "1000" },
      200,
      "OK",
    );

    const price = await getMarketPrice("BTC");

    expect(price.prevDayPx).toBeNull();
    expect(price.change24h).toBeNull();
    expect(price.quote?.prevDayPx).toBeNull();
    expect(price.quote?.change24h).toBeNull();
    expect(price.markPx).toBe(100);
    expect(price.midPx).toBe(99);
  });

  test("leaves missing open interest and funding null instead of zero", async () => {
    globalThis.fetch = respondWith(
      { symbol: "BTC", markPx: "100", midPx: "99", prevDayPx: "90", dayNtlVlm: "1000" },
      200,
      "OK",
    );

    const price = await getMarketPrice("BTC");

    expect(price.openInterest).toBeNull();
    expect(price.funding).toBeNull();
    expect(price.quote?.openInterest).toBeNull();
    expect(price.quote?.funding).toBeNull();
    expect(price.volume24h).toBe(1000);
  });

  test("yields a null change when prevDayPx is zero", async () => {
    globalThis.fetch = respondWith(
      { symbol: "BTC", markPx: "100", midPx: "99", prevDayPx: "0" },
      200,
      "OK",
    );

    const price = await getMarketPrice("BTC");

    expect(price.prevDayPx).toBe(0);
    expect(price.change24h).toBeNull();
    expect(price.quote?.prevDayPx).toBe(0);
    expect(price.quote?.change24h).toBeNull();
  });

  test("reports a null quote when the ticker carries no price source", async () => {
    globalThis.fetch = respondWith({ symbol: "BTC", dayNtlVlm: "1000" }, 200, "OK");

    const price = await getMarketPrice("BTC");

    expect(price.quote).toBeNull();
    expect(price.price).toBe(0);
    expect(price.markPx).toBeNull();
    expect(price.midPx).toBeNull();
    expect(price.prevDayPx).toBeNull();
    expect(price.change24h).toBeNull();
    expect(price.volume24h).toBe(1000);
    expect(price.openInterest).toBeNull();
    expect(price.funding).toBeNull();
  });

  test("rejects with the API error instead of fabricating zero prices", async () => {
    globalThis.fetch = respondWith({ error: "upstream unavailable" }, 502, "Bad Gateway");

    const error = await capture(getMarketPrice("BTC"));

    expect(error instanceof ApiError).toBe(true);
    expect(statusOf(error)).toBe(502);
  });
});
