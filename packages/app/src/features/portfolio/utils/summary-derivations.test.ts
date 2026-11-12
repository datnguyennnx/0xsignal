/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type {
  ClearinghouseState,
  PortfolioPeriod as PortfolioPeriodData,
  PortfolioResponse,
  SpotClearinghouseState,
  UserVaultEquity,
} from "@0xsignal/shared";

import {
  deriveSummaryPeriod,
  deriveSummaryPerps,
  deriveSummarySpot,
  deriveSummaryVaults,
  selectPortfolioSummaryState,
} from "./summary-derivations";

const T0 = 1_700_000_000_000;
const T1 = 1_700_000_100_000;

function periodWith(pnl: string): PortfolioPeriodData {
  return {
    accountValueHistory: [
      [T0, "100"],
      [T1, "80"],
    ],
    pnlHistory: [[T1, pnl]],
    vlm: "1000",
  };
}

const portfolio: PortfolioResponse = [
  ["day", periodWith("1")],
  ["week", periodWith("2")],
  ["month", periodWith("12.5")],
  ["allTime", periodWith("4")],
  ["perpDay", periodWith("5")],
  ["perpWeek", periodWith("6")],
  ["perpMonth", periodWith("7")],
  ["perpAllTime", periodWith("8")],
];

const clearinghouse: ClearinghouseState = {
  marginSummary: {
    accountValue: "50",
    totalNtlPos: "0",
    totalRawUsd: "0",
    totalMarginUsed: "0",
  },
  crossMarginSummary: {
    accountValue: "50",
    totalNtlPos: "0",
    totalRawUsd: "0",
    totalMarginUsed: "0",
  },
  crossMaintenanceMarginUsed: "0",
  withdrawable: "50",
  assetPositions: [],
  time: T1,
};

describe("selectPortfolioSummaryState", () => {
  const baseGateInput = {
    isOwn: true,
    ownAddress: undefined as string | undefined,
    isLoading: false,
    isError: false,
    portfolio: undefined as PortfolioResponse | undefined,
  };
  const connected = {
    ...baseGateInput,
    ownAddress: "0x0000000000000000000000000000000000000002",
  };

  test("an own card without an address is first-use empty even while reads are pending", () => {
    expect(selectPortfolioSummaryState(baseGateInput)).toEqual({
      status: "empty",
      reason: "first-use",
    });
    expect(
      selectPortfolioSummaryState({
        ...baseGateInput,
        isLoading: true,
        isError: true,
      }),
    ).toEqual({ status: "empty", reason: "first-use" });
  });

  test("a whale card never asks the viewer to connect their wallet", () => {
    expect(
      selectPortfolioSummaryState({
        ...baseGateInput,
        isOwn: false,
        ownAddress: undefined,
      }),
    ).toEqual({ status: "empty", reason: "first-use" });
    expect(
      selectPortfolioSummaryState({
        ...baseGateInput,
        isOwn: false,
        ownAddress: undefined,
        isLoading: true,
      }),
    ).toEqual({ status: "loading" });
  });

  test("loading wins over error, and error wins over a missing portfolio", () => {
    expect(selectPortfolioSummaryState({ ...connected, isLoading: true, isError: true })).toEqual({
      status: "loading",
    });
    expect(selectPortfolioSummaryState({ ...connected, isError: true }).status).toBe("error");
    expect(selectPortfolioSummaryState(connected)).toEqual({
      status: "empty",
      reason: "first-use",
    });
  });

  test("a resolved portfolio on a connected card is ready", () => {
    expect(selectPortfolioSummaryState({ ...connected, portfolio })).toEqual({
      status: "ready",
      data: portfolio,
      stale: false,
    });
  });
});

describe("deriveSummaryPeriod", () => {
  test("selects the requested period slot", () => {
    expect(deriveSummaryPeriod(portfolio, "month")?.pnlHistory.at(-1)?.[1]).toBe("12.5");
    expect(deriveSummaryPeriod(portfolio, "allTime")?.pnlHistory.at(-1)?.[1]).toBe("4");
  });

  test("returns null without a portfolio read", () => {
    expect(deriveSummaryPeriod(undefined, "month")).toBeNull();
  });
});

describe("deriveSummaryPerps", () => {
  test("prefers the clearinghouse account value and keeps pnl, volume, drawdown", () => {
    const perps = deriveSummaryPerps(clearinghouse, deriveSummaryPeriod(portfolio, "month"));

    expect(perps.accountValue).toBe(50);
    expect(perps.pnl).toBe(12.5);
    expect(perps.volume).toBe(1000);
    expect(perps.maxDd).toBeCloseTo(-0.2, 10);
  });

  test("falls back to the portfolio's last account value without a clearinghouse read", () => {
    const period = deriveSummaryPeriod(portfolio, "month");
    const perps = deriveSummaryPerps(undefined, period);

    expect(perps.accountValue).toBe(80);
    expect(perps.pnl).toBe(12.5);
    expect(perps.maxDd).toBeCloseTo(-0.2, 10);
  });

  test("returns nulls when no period resolved", () => {
    expect(deriveSummaryPerps(undefined, null)).toEqual({
      accountValue: null,
      pnl: null,
      volume: null,
      maxDd: null,
    });
  });
});

describe("deriveSummarySpot", () => {
  const spot = (balances: SpotClearinghouseState["balances"]): SpotClearinghouseState => ({
    balances,
  });

  test("sums only quote-asset balances", () => {
    expect(
      deriveSummarySpot(
        spot([
          { coin: "USDC", token: 0, total: "10.5", hold: "0", entryNtl: "0" },
          { coin: "BTC", token: 1, total: "999", hold: "0", entryNtl: "0" },
        ]),
      ),
    ).toEqual({ totalUsdc: 10.5 });
  });

  test("returns zero without a quote balance and null without spot data", () => {
    expect(
      deriveSummarySpot(spot([{ coin: "BTC", token: 1, total: "999", hold: "0", entryNtl: "0" }])),
    ).toEqual({ totalUsdc: 0 });
    expect(deriveSummarySpot(undefined)).toBeNull();
  });
});

describe("deriveSummaryVaults", () => {
  test("sums vault equity and preserves the empty/null distinction", () => {
    const vaults: UserVaultEquity[] = [
      { vaultAddress: "0x1", equity: "10.5" },
      { vaultAddress: "0x2", equity: "4.5" },
    ];

    expect(deriveSummaryVaults(vaults)).toEqual({ totalEquity: 15 });
    expect(deriveSummaryVaults([])).toEqual({ totalEquity: 0 });
    expect(deriveSummaryVaults(undefined)).toBeNull();
  });
});
