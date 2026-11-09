/// <reference types="bun-types" />
import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider, type Query } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";

const OWN = "0x0000000000000000000000000000000000000001";
const WHALE = "0x0000000000000000000000000000000000000002";

// The exchange bundle reads window.localStorage at import time; these tests only
// exercise the server-rendered tree, so a minimal storage shim is enough.
if (globalThis.window === undefined) {
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      location: { pathname: "/", origin: "http://localhost", protocol: "http:", host: "localhost" },
      matchMedia: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    configurable: true,
    writable: true,
  });
}

const wagmiStubs = () => ({
  useConnection: () => ({ isConnected: false }),
  useConnect: () => ({ mutate: () => {}, isPending: false }),
  useConnectors: () => [],
  useDisconnect: () => ({ mutate: () => {} }),
  useSignMessage: () => ({
    signMessageAsync: () => Promise.resolve("0x"),
    mutateAsync: () => Promise.resolve("0x"),
  }),
});

mock.module("wagmi", wagmiStubs);

const authStoreModule = await import("@/stores/use-auth-store");
const effectiveAddressModule = await import("@/hooks/use-effective-address");
const exchangeModule = await import("@/services/exchange");

const { PositionManagement } = await import("./position-management");
const { BalancesTab, OrderHistoryTab, TradeHistoryTab } = await import("./position-tabs");
const { OpenOrdersTab } = await import("./open-orders-tab");
const { PositionsTab } = await import("./positions-tab");
const { FundingHistoryTable } = await import("./funding-history-table");
const { TwapContent } = await import("./twap-content");

// The whale route is simulated with the viewer signed in and connected, which is
// the state where an unaddressed user hook would leak the viewer's own account.
// The stubs are installed per test so `mock.restore()` in afterEach leaves the
// modules the next file in this Bun process sees untouched.
const installStubs = (): void => {
  mock.module("wagmi", wagmiStubs);

  const state = { ...authStoreModule.useAuthStore.getState(), isAuthenticated: true };
  function fakeUseAuthStore(): typeof state;
  function fakeUseAuthStore<T>(selector: (snapshot: typeof state) => T): T;
  function fakeUseAuthStore<T>(selector?: (snapshot: typeof state) => T): T | typeof state {
    return selector === undefined ? state : selector(state);
  }
  spyOn(authStoreModule, "useAuthStore").mockImplementation(
    Object.assign(fakeUseAuthStore, authStoreModule.useAuthStore, { getState: () => state }),
  );

  spyOn(effectiveAddressModule, "useOwnAddress").mockReturnValue(OWN);
  spyOn(effectiveAddressModule, "useWhaleAddress").mockReturnValue(WHALE);
  spyOn(effectiveAddressModule, "useIsSigningDisabled").mockReturnValue(true);

  spyOn(exchangeModule, "submitPlaceOrder").mockImplementation(() => Promise.resolve());
  spyOn(exchangeModule, "submitCancelOrders").mockResolvedValue("0x");
};

const renderTree = (element: ReactElement): { html: string; client: QueryClient } => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { html, client };
};

const userQueries = (client: QueryClient) =>
  client
    .getQueryCache()
    .getAll()
    .filter((query) => query.queryKey[0] === "user");

// `enabled` lives on the observer options, not the base `QueryOptions` type.
const isEnabled = (query: Query): boolean => Reflect.get(query.options, "enabled") === true;

const requiredWhaleQuery = (client: QueryClient, leaf: string): Query => {
  const query = client
    .getQueryCache()
    .getAll()
    .find((candidate) => candidate.queryKey[0] === "whales" && candidate.queryKey[1] === leaf);
  expect(query).toBeDefined();
  if (query === undefined) throw new Error(`missing whale ${leaf} query`);
  return query;
};

const noop = (): void => undefined;

const renderWhalePanels = (): { html: string; client: QueryClient } =>
  renderTree(
    <>
      <BalancesTab readOnlyAddress={WHALE} />
      <PositionsTab
        positions={[]}
        isChLoading={false}
        readOnly
        onCloseMarket={noop}
        onCloseLimit={noop}
      />
      <OpenOrdersTab
        readOnlyAddress={WHALE}
        onCancelOrder={noop}
        onViewTpSl={noop}
        onCancelAll={noop}
        isCancelPending={false}
      />
      <TwapContent readOnly />
      <TradeHistoryTab readOnlyAddress={WHALE} />
      <FundingHistoryTable readOnlyAddress={WHALE} />
      <OrderHistoryTab readOnlyAddress={WHALE} />
    </>,
  );

beforeEach(() => {
  installStubs();
});

afterEach(() => {
  mock.restore();
});

afterAll(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("whale panel tree has no auth-gated read", () => {
  test("every user/* query registered by the panel tree is disabled", () => {
    const { client } = renderWhalePanels();
    const own = userQueries(client);

    expect(own.length).toBeGreaterThan(0);
    for (const query of own) {
      expect(isEnabled(query)).toBe(false);
    }
  });

  test("the third party's data is read from the public whale keys", () => {
    const { client } = renderWhalePanels();

    for (const leaf of [
      "clearinghouseState",
      "spotClearinghouseState",
      "openOrders",
      "fills",
      "userFunding",
      "historicalOrders",
    ]) {
      const query = requiredWhaleQuery(client, leaf);
      expect(query.queryKey).toContain(WHALE);
      expect(isEnabled(query)).toBe(true);
    }
  });

  test("the management shell opens no own-account query in read-only mode", () => {
    const { client } = renderTree(<PositionManagement readOnlyAddress={WHALE} />);
    const own = userQueries(client);

    expect(own.length).toBeGreaterThan(0);
    for (const query of own) {
      expect(isEnabled(query)).toBe(false);
    }
  });
});
