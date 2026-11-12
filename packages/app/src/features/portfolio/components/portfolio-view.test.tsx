/// <reference types="bun-types" />
import "../../../../test/setup";
import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { MemoryRouter } from "react-router";

let positionMounts = 0;

mock.module("@/features/trade/components/position-management", () => ({
  PositionManagement: () => {
    positionMounts += 1;
    return null;
  },
}));

mock.module("@/features/portfolio/components/portfolio-overview", () => ({
  PortfolioOverview: () => createElement("div", null, "portfolio overview"),
}));

mock.module("@/hooks/use-effective-address", () => ({
  useOwnAddress: () => undefined,
  useWhaleAddress: () => undefined,
  useIsSigningDisabled: () => false,
}));

const { PortfolioView } = await import("./portfolio-view");
const { useAppStore } = await import("@/stores/use-app-store");
const { cleanup, fireEvent, renderDom } = await import("../../../../test/render");

function renderView() {
  return renderDom(createElement(MemoryRouter, null, createElement(PortfolioView)));
}

afterEach(() => {
  positionMounts = 0;
  cleanup();
  useAppStore.setState({ connectWalletOpen: {} });
});
afterAll(() => {
  mock.restore();
});

describe("PortfolioView without a wallet", () => {
  test("keeps the positions panel, its balances copy, and a working connect action", () => {
    const view = renderView();

    const panel = view.container.querySelector('[data-tier="content"][data-radius="panel"]');
    expect(panel).not.toBeNull();

    const text = view.container.textContent ?? "";
    expect(text).toContain("Connect your wallet to see your balances.");
    expect(text).not.toContain("Connect your wallet to see your portfolio.");

    const connect = [...view.container.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === "Connect Wallet",
    );
    expect(connect).toBeDefined();
    expect(useAppStore.getState().connectWalletOpen["portfolio-positions"] ?? false).toBe(false);

    fireEvent.click(connect as HTMLButtonElement);
    expect(useAppStore.getState().connectWalletOpen["portfolio-positions"]).toBe(true);

    expect(positionMounts).toBe(0);
  });
});
