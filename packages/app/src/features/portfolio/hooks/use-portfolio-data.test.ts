/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { whaleClearinghouseStateQuery } from "./use-portfolio-data";

const WHALE = "0x0000000000000000000000000000000000000002";
const HL_INFO_URL = "https://api.hyperliquid.xyz";
const realFetch = globalThis.fetch;

interface Captured {
  readonly url: string;
  readonly authorization: string | null;
}

const stubFetch = (payload: unknown): Captured[] => {
  const calls: Captured[] = [];
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  return calls;
};

const emptyState = {
  marginSummary: { accountValue: "0", totalNtlPos: "0", totalRawUsd: "0", totalMarginUsed: "0" },
  crossMarginSummary: {
    accountValue: "0",
    totalNtlPos: "0",
    totalRawUsd: "0",
    totalMarginUsed: "0",
  },
  crossMaintenanceMarginUsed: "0",
  withdrawable: "0",
  assetPositions: [],
  time: 1_700_000_000_000,
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("whale clearinghouse query", () => {
  test("is disabled without an address", () => {
    expect(whaleClearinghouseStateQuery().enabled).toBe(false);
    expect(whaleClearinghouseStateQuery("").enabled).toBe(false);
    expect(whaleClearinghouseStateQuery(WHALE).enabled).toBe(true);
  });

  test("needs no auth session and reads the whale directly", async () => {
    const calls = stubFetch(emptyState);

    const state = await whaleClearinghouseStateQuery(WHALE).queryFn();

    expect(state).toEqual(emptyState);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.startsWith(HL_INFO_URL)).toBe(true);
    expect(calls[0]?.authorization).toBeNull();
    expect(calls.some((call) => call.url.includes("/api/user/"))).toBe(false);
  });
});
