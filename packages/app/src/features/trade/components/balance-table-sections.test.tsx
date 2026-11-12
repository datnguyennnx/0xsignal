/// <reference types="bun-types" />
import "../../../../test/setup";
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

// The DOM globals live in one shared Bun process and an SSR test removes them.
// Reinstall a realm so this file's behavior test runs regardless of file order.
function ensureDom(): void {
  if ("document" in globalThis && globalThis.document !== undefined) return;
  const window = new Window({ url: "http://localhost/" });
  const globals: Record<string, unknown> = {
    window,
    document: window.document,
    navigator: window.navigator,
    location: window.location,
    history: window.history,
  };
  for (const name of [
    "Node",
    "Element",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLButtonElement",
    "HTMLTemplateElement",
    "SVGElement",
    "DocumentFragment",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "FocusEvent",
    "MutationObserver",
    "ResizeObserver",
    "DOMRect",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "matchMedia",
  ]) {
    const value: unknown = Reflect.get(window, name);
    globals[name] = typeof value === "function" ? value.bind(window) : value;
  }
  for (const [name, value] of Object.entries(globals)) {
    try {
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    } catch {
      // a non-configurable global keeps its own implementation
    }
  }
}

ensureDom();
beforeEach(ensureDom);

// No wallet, no account: the trade path should be one content-sized panel, not
// the connected tab shell. The wallet module is stubbed so a regressed guard
// would mount a real hook and fail instead of silently reading a fake.
mock.module("wagmi", () => ({
  useConnection: () => ({ isConnected: false, address: undefined, chainId: undefined }),
  useConnect: () => ({ mutate: () => {}, isPending: false }),
  useConnectors: () => [],
  useDisconnect: () => ({ mutate: () => {} }),
  useSignMessage: () => ({
    signMessageAsync: () => Promise.resolve("0x"),
    mutateAsync: () => Promise.resolve("0x"),
  }),
}));

mock.module("@/hooks/use-effective-address", () => ({
  useOwnAddress: () => undefined,
  useWhaleAddress: () => undefined,
  useIsSigningDisabled: () => false,
}));

const { PositionManagement } = await import("./position-management");
const { BalanceTable } = await import("./balance-table");
const { Surface } = await import("@/components/surface/surface");
const { useAppStore } = await import("@/stores/use-app-store");
const { cleanup, fireEvent, renderDom } = await import("../../../../test/render");

const CONNECT_KEY = "trade-position-management";

const EMPTY_BALANCES = {
  isChLoading: false,
  marginSummary: null,
  positions: [],
  usdcTotalBalance: 0,
  usdcAvailableBalance: 0,
  totalUnrealizedPnl: 0,
  effectiveAccountTotal: 0,
  effectiveAvailableBalance: 0,
};

function renderNoWallet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderDom(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, null, createElement(PositionManagement, {})),
    ),
  );
}

function renderBalancesPanel() {
  return renderDom(
    createElement(
      Surface,
      { tier: "content", radius: "panel", className: "flex flex-col p-3 gap-3" },
      createElement(BalanceTable, EMPTY_BALANCES),
    ),
  );
}

const connectButton = (container: HTMLElement): HTMLButtonElement | undefined =>
  [...container.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === "Connect Wallet",
  );

afterEach(() => {
  cleanup();
  useAppStore.setState({ connectWalletOpen: {} });
});
afterAll(() => {
  mock.restore();
});

describe("trade positions panel without a wallet", () => {
  test("is one panel: header kept, action inside it, no connected tab shell", () => {
    const view = renderNoWallet();

    const panel = view.container.querySelector('[data-tier="content"][data-radius="panel"]');
    expect(panel).not.toBeNull();

    // The connected tab shell must not mount when there is no account.
    expect(view.container.querySelector('[data-slot="tabs"]')).toBeNull();

    // HEAD rendered the balances header over the empty body; keep it, in one row.
    const header = view.container.querySelector("thead");
    expect(header).not.toBeNull();
    expect(header?.textContent ?? "").toContain("USDC Value");

    const rows = view.container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0]?.querySelector("td")?.getAttribute("colspan")).toBe("6");

    const connect = connectButton(view.container);
    expect(connect).toBeDefined();
    // The action must be a descendant of the same Surface as the copy.
    expect(panel?.contains(connect as Node)).toBe(true);
  });

  test("clicks through the shared connect opener, not a second path", () => {
    const view = renderBalancesPanel();
    expect(useAppStore.getState().connectWalletOpen[CONNECT_KEY] ?? false).toBe(false);

    const connect = connectButton(view.container);
    fireEvent.click(connect as HTMLButtonElement);

    expect(useAppStore.getState().connectWalletOpen[CONNECT_KEY]).toBe(true);
  });
});
