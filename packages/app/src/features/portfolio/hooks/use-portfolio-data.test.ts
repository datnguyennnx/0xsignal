/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { whaleClearinghouseStateQuery } from "./use-portfolio-data";

import { HL_INFO_URL, stubFetch } from "../../../test/fixtures";

const WHALE = "0x0000000000000000000000000000000000000002";
const realFetch = globalThis.fetch;

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
