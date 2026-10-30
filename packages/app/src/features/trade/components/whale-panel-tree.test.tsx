/// <reference types="bun-types" />
import { afterAll, describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider, type Query } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

const OWN = "0x0000000000000000000000000000000000000001";
const WHALE = "0x0000000000000000000000000000000000000002";

// The whale route is simulated with the viewer signed in and connected, which is
// the state where an unaddressed user hook would leak the viewer's own account.
// Zustand reads `getInitialState` on the server, so a real store cannot be signed
// in for an SSR render; this stub is the signed-in gate the route must not reach.
mock.module("@/stores/use-auth-store", () => {
  const state = { isAuthenticated: true };
  const useAuthStore = <T,>(selector: (snapshot: typeof state) => T): T => selector(state);
  Object.assign(useAuthStore, {
    getState: () => state,
    setState: () => {},
    subscribe: () => () => {},
  });
  return { useAuthStore };
});

mock.module("@/hooks/use-effective-address", () => ({
  useOwnAddress: () => OWN,
  useWhaleAddress: () => WHALE,
  useIsSigningDisabled: () => true,
}));

// The exchange bundle touches `window` at import time; the shell only needs the
// mutation surfaces, which this test never invokes.
mock.module("@/services/exchange", () => ({
  submitCancelOrders: () => Promise.resolve(),
  submitPlaceOrder: () => Promise.resolve(),
}));

mock.module("wagmi", () => ({
  useConnection: () => ({ isConnected: false }),
  useConnect: () => ({ mutate: () => {}, isPending: false }),
  useConnectors: () => [],
  useDisconnect: () => ({ mutate: () => {} }),
  useSignMessage: () => ({
    signMessageAsync: () => Promise.resolve("0x"),
    mutateAsync: () => Promise.resolve("0x"),
  }),
}));

const { PositionManagement } = await import("./position-management");
const { BalancesTab, OrderHistoryTab, TradeHistoryTab } = await import("./position-tabs");
const { OpenOrdersTab } = await import("./open-orders-tab");
const { PositionsTab } = await import("./positions-tab");
const { FundingHistoryTable } = await import("./funding-history-table");
const { TwapContent } = await import("./twap-content");

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

afterAll(() => {
  mock.restore();
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
