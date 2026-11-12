/// <reference types="bun-types" />
import "../../../../test/setup";
import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { createElement } from "react";
import { MemoryRouter } from "react-router";

// Other suites in this Bun process delete the DOM globals without restoring
// them, so reinstall a window when this file runs after one of them.
if (!("document" in globalThis)) {
  const window = new Window({ url: "http://localhost/" });
  for (const [name, value] of [
    ["window", window],
    ["document", window.document],
    ["navigator", window.navigator],
  ] as const) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
}

const noQuery = () => ({
  data: undefined,
  isLoading: false,
  isError: false,
  refetch: async () => undefined,
});

let chartLoads = 0;

mock.module("@/hooks/use-effective-address", () => ({
  useOwnAddress: () => undefined,
  useWhaleAddress: () => undefined,
  useIsSigningDisabled: () => false,
}));

mock.module("@/features/portfolio/hooks/use-portfolio-data", () => ({
  usePortfolio: noQuery,
  useWhalePortfolio: noQuery,
  useUserVaultEquities: noQuery,
  useWhaleClearinghouseState: noQuery,
  useWhaleSpotClearinghouseState: noQuery,
  useWhaleVaultEquities: noQuery,
}));

mock.module("@/features/trade/hooks/use-user-data", () => ({
  useClearinghouseState: noQuery,
  useSpotClearinghouseState: noQuery,
}));

mock.module("@/features/portfolio/lib/preload-pnl-chart", () => ({
  preloadPnlChart: () => {
    chartLoads += 1;
    return Promise.resolve({ PortfolioPnLChart: () => null });
  },
}));

const { PortfolioOverview } = await import("./portfolio-overview");
const { cleanup, renderDom } = await import("../../../../test/render");

afterEach(() => {
  chartLoads = 0;
  cleanup();
});
afterAll(() => {
  mock.restore();
});

describe("PortfolioOverview without a wallet", () => {
  test("paints both cards and the PnL empty copy before the chart chunk is requested", () => {
    const view = renderDom(createElement(MemoryRouter, null, createElement(PortfolioOverview)));

    const text = view.container.textContent ?? "";
    expect(text).toContain("Connect your wallet to see your portfolio.");
    expect(text).toContain("No PnL history");
    expect(text).toContain("Connect your wallet to see your PnL history.");

    expect(chartLoads).toBe(0);
  });
});
