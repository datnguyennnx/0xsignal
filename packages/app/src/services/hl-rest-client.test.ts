/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ApiError } from "../lib/api-error";
import { registerAuthTokenBridge } from "../lib/auth-token";

import {
  DIRECT_READS,
  getCandleSnapshot,
  getHistoricalOrders,
  getPortfolio,
  getUserFunding,
  getUserVaultEquities,
} from "./hl-rest-client";

const USER = "0x0000000000000000000000000000000000000000";
const HL_INFO_URL = "https://api.hyperliquid.xyz";
const realFetch = globalThis.fetch;

interface CapturedRequest {
  readonly url: string;
  readonly body: unknown;
  readonly authorization: string | null;
}

type FetchHandler = (url: string, body: unknown) => Response | Promise<Response>;

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Direct Hyperliquid replies go out raw; the backend wraps them in `{ data }`. */
const directOrBackend = (payload: unknown): FetchHandler => {
  return (url) =>
    url.startsWith(HL_INFO_URL) ? jsonResponse(payload) : jsonResponse({ data: payload });
};

const backendOnly = (payload: unknown): FetchHandler => {
  return () => jsonResponse({ data: payload });
};

const failingDirectThenBackend = (payload: unknown): FetchHandler => {
  return (url) => {
    if (url.startsWith(HL_INFO_URL)) throw new TypeError("network down");
    return jsonResponse({ data: payload });
  };
};

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : "");

const errorStatus = (error: unknown): number | undefined => {
  if (!(error instanceof ApiError)) return undefined;
  const status = error.status;
  return typeof status === "number" ? status : undefined;
};

const rejectFallback = (): Promise<never> => Promise.reject(new Error("must not fall back"));

function stubFetch(handler: FetchHandler): CapturedRequest[] {
  const calls: CapturedRequest[] = [];
  const stub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({
      url,
      body,
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    const response = await handler(url, body);
    return response;
  };
  globalThis.fetch = stub;
  return calls;
}

const callsTo = (calls: CapturedRequest[], prefix: string): CapturedRequest[] =>
  calls.filter((call) => call.url.startsWith(prefix));

interface PortfolioPeriodFixture {
  readonly accountValueHistory: [number, string][];
  readonly pnlHistory: [number, string][];
  readonly vlm: string;
}

const portfolioPeriod = (vlm: string): PortfolioPeriodFixture => ({
  accountValueHistory: [[1_700_000_000_000, "1000"]],
  pnlHistory: [[1_700_000_000_000, "10"]],
  vlm,
});

const portfolioFixture = [
  ["day", portfolioPeriod("1")],
  ["week", portfolioPeriod("2")],
  ["month", portfolioPeriod("3")],
  ["allTime", portfolioPeriod("4")],
  ["perpDay", portfolioPeriod("5")],
  ["perpWeek", portfolioPeriod("6")],
  ["perpMonth", portfolioPeriod("7")],
  ["perpAllTime", portfolioPeriod("8")],
];

beforeEach(() => {
  // Every backend fallback now targets /api/user/*, which requires the session token.
  registerAuthTokenBridge({ read: () => "test-session-token", write: () => {} });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  DIRECT_READS.enabled = true;
  registerAuthTokenBridge({ read: () => null, write: () => {} });
});

describe("browser-direct Hyperliquid reads", () => {
  test("portfolio sends the documented body and returns the eight-period tuple", async () => {
    const calls = stubFetch(directOrBackend(portfolioFixture));

    const result = await getPortfolio(USER);

    expect(callsTo(calls, HL_INFO_URL)).toHaveLength(1);
    expect(calls[0]?.body).toEqual({ type: "portfolio", user: USER });
    expect(result).toEqual(portfolioFixture);
    expect(result[0]?.[0]).toBe("day");
  });

  test("historical orders sends the documented body and keeps the old entry shape", async () => {
    const entry = {
      order: {
        coin: "BTC",
        side: "A",
        sz: "0.1",
        limitPx: "62000",
        oid: 5001,
        timestamp: 1_700_000_000_000,
      },
      status: "filled",
      statusTimestamp: 1_700_000_100_000,
    };
    const calls = stubFetch(directOrBackend([entry]));

    const result = await getHistoricalOrders(USER);

    expect(calls[0]?.body).toEqual({ type: "historicalOrders", user: USER });
    expect(result).toEqual([entry]);
  });

  test("vault equities sends the documented body and returns the unchanged array", async () => {
    const equities = [
      {
        vaultAddress: "0x1111111111111111111111111111111111111111",
        equity: "250.5",
        lockedUntilTimestamp: 1_700_000_000_000,
      },
    ];
    const calls = stubFetch(directOrBackend(equities));

    const result = await getUserVaultEquities(USER);

    expect(calls[0]?.body).toEqual({ type: "userVaultEquities", user: USER });
    expect(result).toEqual(equities);
  });

  test("funding forwards both bounds and normalises a null sample count", async () => {
    const entries = [
      {
        time: 1_700_000_000_000,
        hash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        delta: {
          type: "funding",
          coin: "ETH",
          usdc: "-1.25",
          szi: "2",
          fundingRate: "0.0001",
          nSamples: null,
        },
      },
    ];
    const calls = stubFetch(directOrBackend(entries));

    const result = await getUserFunding(USER, 1_700_000_000_000, 1_700_000_300_000);

    expect(calls[0]?.body).toEqual({
      type: "userFunding",
      user: USER,
      startTime: 1_700_000_000_000,
      endTime: 1_700_000_300_000,
    });
    expect(result).toEqual([
      {
        time: entries[0]?.time,
        hash: entries[0]?.hash,
        delta: {
          type: "funding",
          coin: "ETH",
          usdc: "-1.25",
          szi: "2",
          fundingRate: "0.0001",
          nSamples: 0,
        },
      },
    ]);
  });

  test("funding without bounds sends no time keys", async () => {
    const calls = stubFetch(directOrBackend([]));

    await getUserFunding(USER);

    expect(calls[0]?.body).toEqual({ type: "userFunding", user: USER });
  });

  test("a transport failure falls back to the backend route", async () => {
    const calls = stubFetch(failingDirectThenBackend(portfolioFixture));

    const result = await getPortfolio(USER);

    expect(result).toEqual(portfolioFixture);
    expect(callsTo(calls, HL_INFO_URL)).toHaveLength(1);
    expect(callsTo(calls, "/api/user/portfolio")).toHaveLength(1);
  });

  test("a Hyperliquid application error rejects instead of returning an empty result", async () => {
    const calls = stubFetch(() => jsonResponse({ error: "User not found" }));

    const failure: unknown = await getPortfolio(USER).catch((cause: unknown) => cause);

    expect(errorMessage(failure)).toBe("User not found");
    expect(callsTo(calls, "/api/user/portfolio")).toHaveLength(0);
  });

  test("an HTTP failure keeps its status for the retry policy and does not fall back", async () => {
    const calls = stubFetch(() => jsonResponse({ error: "rate limited" }, 429));

    const failure: unknown = await getHistoricalOrders(USER).catch((cause: unknown) => cause);

    expect(errorStatus(failure)).toBe(429);
    expect(callsTo(calls, "/api/user/historical-orders")).toHaveLength(0);
  });

  test("candle snapshots go browser-direct with the resolved coin and no Authorization", async () => {
    const raw = [
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
    ];
    const calls = stubFetch(directOrBackend(raw));

    const result = await getCandleSnapshot(
      { coin: "BTC", interval: "1h", startTime: 1_700_000_000_000, endTime: 1_700_000_300_000 },
      rejectFallback,
    );

    expect(callsTo(calls, HL_INFO_URL)).toHaveLength(1);
    expect(calls[0]?.body).toEqual({
      type: "candleSnapshot",
      req: {
        coin: "BTC",
        interval: "1h",
        startTime: 1_700_000_000_000,
        endTime: 1_700_000_300_000,
      },
    });
    expect(calls[0]?.authorization).toBeNull();
    expect(result).toEqual([
      { time: 1_700_000_000, open: 1, high: 3, low: 0.5, close: 2, volume: 10 },
    ]);
  });

  test("a candle network failure falls back to the caller's backend route", async () => {
    const calls = stubFetch(() => {
      throw new TypeError("network down");
    });
    const fallbackResult = [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }];

    const result = await getCandleSnapshot(
      { coin: "BTC", interval: "1h", startTime: 1, endTime: 2 },
      () => Promise.resolve(fallbackResult),
    );

    expect(result).toEqual(fallbackResult);
    expect(callsTo(calls, HL_INFO_URL)).toHaveLength(1);
  });

  test("a candle application error rejects instead of returning an empty list", async () => {
    stubFetch(() => jsonResponse({ error: "Invalid coin" }));
    let fallbackCalls = 0;

    const failure: unknown = await getCandleSnapshot(
      { coin: "NOPE", interval: "1h", startTime: 1, endTime: 2 },
      () => {
        fallbackCalls += 1;
        return Promise.resolve([]);
      },
    ).catch((cause: unknown) => cause);

    expect(errorMessage(failure)).toBe("Invalid coin");
    expect(fallbackCalls).toBe(0);
  });

  test("the rollback flag routes every read through the backend", async () => {
    DIRECT_READS.enabled = false;
    const calls = stubFetch(backendOnly(portfolioFixture));

    const result = await getPortfolio(USER);

    expect(result).toEqual(portfolioFixture);
    expect(callsTo(calls, HL_INFO_URL)).toHaveLength(0);
    expect(callsTo(calls, "/api/user/portfolio")).toHaveLength(1);
  });
});
