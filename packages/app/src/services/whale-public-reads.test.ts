/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import {
  getClearinghouseStatePublic,
  getHistoricalOrdersPublic,
  getOpenOrdersPublic,
  getPortfolioPublic,
  getSpotClearinghouseStatePublic,
  getUserFillsPublic,
  getUserFundingPublic,
  getUserVaultEquitiesPublic,
} from "./hl-rest-client";

const WHALE = "0x0000000000000000000000000000000000000002";
const HL_INFO_URL = "https://api.hyperliquid.xyz";
const realFetch = globalThis.fetch;

interface Captured {
  url: string;
  authorization: string | null;
  body: unknown;
}

const stubFetch = (payload: unknown): Captured[] => {
  const calls: Captured[] = [];
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url, authorization: headers.get("Authorization"), body });
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  return calls;
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("public whale reads", () => {
  test("portfolio goes straight to Hyperliquid with no Bearer token", async () => {
    const calls = stubFetch([]);

    await getPortfolioPublic(WHALE);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.startsWith(HL_INFO_URL)).toBe(true);
    expect(calls[0]?.authorization).toBeNull();
  });

  test("vault equities never touch the authenticated backend route", async () => {
    const calls = stubFetch([]);

    await getUserVaultEquitiesPublic(WHALE);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.startsWith(HL_INFO_URL)).toBe(true);
    expect(calls.some((call) => call.url.includes("/api/user/"))).toBe(false);
    expect(calls[0]?.authorization).toBeNull();
  });

  test("clearinghouse state is a direct public request for an arbitrary address", async () => {
    const state = {
      marginSummary: {
        accountValue: "1000",
        totalNtlPos: "25000",
        totalRawUsd: "1000",
        totalMarginUsed: "500",
      },
      crossMarginSummary: {
        accountValue: "1000",
        totalNtlPos: "25000",
        totalRawUsd: "1000",
        totalMarginUsed: "500",
      },
      crossMaintenanceMarginUsed: "250",
      withdrawable: "500",
      assetPositions: [],
      time: 1_700_000_000_000,
    };
    const calls = stubFetch(state);

    const result = await getClearinghouseStatePublic(WHALE);

    expect(result).toEqual(state);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.startsWith(HL_INFO_URL)).toBe(true);
    expect(calls[0]?.body).toEqual({ type: "clearinghouseState", user: WHALE });
    expect(calls[0]?.authorization).toBeNull();
    expect(calls.some((call) => call.url.includes("/api/user/"))).toBe(false);
  });
});

describe("public whale sibling reads", () => {
  const cases: Array<{
    readonly name: string;
    readonly type: string;
    readonly read: () => Promise<unknown>;
    readonly payload: unknown;
  }> = [
    {
      name: "open orders",
      type: "openOrders",
      read: () => getOpenOrdersPublic(WHALE),
      payload: [],
    },
    {
      name: "spot balances",
      type: "spotClearinghouseState",
      read: () => getSpotClearinghouseStatePublic(WHALE),
      payload: { balances: [] },
    },
    { name: "fills", type: "userFills", read: () => getUserFillsPublic(WHALE), payload: [] },
    { name: "funding", type: "userFunding", read: () => getUserFundingPublic(WHALE), payload: [] },
    {
      name: "historical orders",
      type: "historicalOrders",
      read: () => getHistoricalOrdersPublic(WHALE),
      payload: [],
    },
  ];

  for (const testCase of cases) {
    test(`${testCase.name} reads the whale directly with no auth`, async () => {
      const calls = stubFetch(testCase.payload);

      await testCase.read();

      expect(calls).toHaveLength(1);
      expect(calls[0]?.url.startsWith(HL_INFO_URL)).toBe(true);
      expect(calls[0]?.body).toEqual({ type: testCase.type, user: WHALE });
      expect(calls[0]?.authorization).toBeNull();
      expect(calls.some((call) => call.url.includes("/api/user/"))).toBe(false);
    });
  }
});
