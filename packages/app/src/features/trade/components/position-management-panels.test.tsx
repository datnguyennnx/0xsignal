/// <reference types="bun-types" />
import { describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderMarkup } from "../../../../test/render";
import { MemoryRouter } from "react-router";

import { Tabs } from "@/components/ui/tabs";
import type { PositionRow } from "./positions-table";

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

const { PositionManagementPanels } = await import("./position-management-panels");
const { selectPositionManagementData, selectTabCounts } =
  await import("../hooks/use-position-management-data");
const { buildCloseLimitSubmission, closeLimitAfterSubmit } =
  await import("../hooks/use-position-modals-state");

const WHALE = "0x0000000000000000000000000000000000000002";

const noop = (): void => {};

const panelClassOf = (html: string): string =>
  /data-slot="tabs-content" class="([^"]*)"/.exec(html)?.[1] ?? "";

const renderReadOnlyPanel = (value: string): string => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Tabs value={value}>
          <PositionManagementPanels
            signingDisabled
            positions={[]}
            isChLoading={false}
            readOnly
            readOnlyAddress={WHALE}
            onCloseMarket={noop}
            onCloseLimit={noop}
            onCancelOrder={noop}
            onViewTpSl={noop}
            onCancelAll={noop}
            isCancelPending={false}
          />
        </Tabs>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("read-only position panels", () => {
  test("remain readable and scrollable instead of blocking pointer events", () => {
    const positions = renderReadOnlyPanel("positions");
    const openOrders = renderReadOnlyPanel("open-orders");

    // The negative checks below are only meaningful if the active panel actually
    // rendered; a regex miss in panelClassOf would otherwise pass silently.
    expect(panelClassOf(positions)).toContain("flex-1");
    expect(panelClassOf(openOrders)).toContain("flex-1");
    expect(positions).toContain("Mark Price");
    expect(openOrders).toContain("Trigger Conditions");

    expect(panelClassOf(positions)).not.toContain("pointer-events-none");
    expect(panelClassOf(openOrders)).not.toContain("pointer-events-none");
    expect(positions).not.toContain("Connect a wallet to trade");
    expect(openOrders).not.toContain("Connect a wallet to trade");
  });
});

// No DOM harness in this package (no @testing-library/jsdom), so the extracted
// data/modal seams are exercised through their pure helpers rather than by
// mounting the hook and firing events.
const position = (coin: string): PositionRow => ({
  position: {
    coin,
    szi: "1",
    entryPx: "1",
    positionValue: "1",
    liquidationPx: null,
    marginUsed: "1",
    unrealizedPnl: "0",
    returnOnEquity: "0",
    cumFunding: { sinceOpen: "0" },
  },
});

const ownPositions = [position("OWN")];
const whalePositions = [position("WHALE")];
const ownRefetch = mock(() => Promise.resolve("own"));
const whaleRefetch = mock(() => Promise.resolve("whale"));

const sources = (readOnly: boolean) => ({
  readOnly,
  ownBalances: {
    positions: ownPositions,
    balanceCount: 7,
    positionsCount: 1,
    isChLoading: false,
  },
  whaleBalances: {
    positions: whalePositions,
    balanceCount: 9,
    positionsCount: 1,
    isChLoading: true,
  },
  ownChState: { isError: false, refetch: ownRefetch },
  whaleState: {
    data: { assetPositions: whalePositions },
    isLoading: true,
    isError: true,
    refetch: whaleRefetch,
  },
  ownOpenOrders: { data: [1, 2, 3], isLoading: false },
  whaleOpenOrders: { data: [1], isLoading: true },
});

describe("position management data selection", () => {
  test("live view reads own balances and own open orders", () => {
    const data = selectPositionManagementData(sources(false));

    expect(data.balanceCount).toBe(7);
    expect(data.positions).toBe(ownPositions);
    expect(data.positionsCount).toBe(1);
    expect(data.isChLoading).toBe(false);
    expect(data.isChError).toBe(false);
    expect(data.openOrdersCount).toBe(3);
    expect(data.isOoLoading).toBe(false);
  });

  test("read-only view reads the whale clearinghouse and whale open orders", () => {
    const data = selectPositionManagementData(sources(true));

    expect(data.balanceCount).toBe(9);
    expect(data.positions).toBe(whalePositions);
    expect(data.positionsCount).toBe(1);
    expect(data.isChLoading).toBe(true);
    expect(data.isChError).toBe(true);
    expect(data.openOrdersCount).toBe(1);
    expect(data.isOoLoading).toBe(true);
  });

  test("retry is wired to the query backing the active view", () => {
    ownRefetch.mockClear();
    whaleRefetch.mockClear();

    void selectPositionManagementData(sources(false)).retryPositions();
    expect(ownRefetch).toHaveBeenCalledTimes(1);
    expect(whaleRefetch).toHaveBeenCalledTimes(0);

    void selectPositionManagementData(sources(true)).retryPositions();
    expect(ownRefetch).toHaveBeenCalledTimes(1);
    expect(whaleRefetch).toHaveBeenCalledTimes(1);
  });

  test("tab counts stay blank while their query loads", () => {
    expect(
      selectTabCounts({
        balanceCount: 7,
        positionsCount: 2,
        openOrdersCount: 3,
        isChLoading: false,
        isOoLoading: false,
      }),
    ).toEqual({ balances: 7, positions: 2, openOrders: 3 });

    expect(
      selectTabCounts({
        balanceCount: 7,
        positionsCount: 2,
        openOrdersCount: 3,
        isChLoading: true,
        isOoLoading: true,
      }),
    ).toEqual({ balances: undefined, positions: undefined, openOrders: undefined });

    // Open orders settle independently of the clearinghouse query.
    expect(
      selectTabCounts({
        balanceCount: 7,
        positionsCount: 2,
        openOrdersCount: 3,
        isChLoading: true,
        isOoLoading: false,
      }),
    ).toEqual({ balances: undefined, positions: undefined, openOrders: 3 });
  });
});

describe("position management modal transitions", () => {
  const closeLimitPosition = { coin: "BTC", sz: 1, isLong: true, markPx: 100 };

  test("no close-limit submit is built without a selected position", () => {
    expect(buildCloseLimitSubmission(null, { price: "100", size: "2" })).toBeNull();
  });

  test("close-limit confirm submits the selected coin, side and form values", () => {
    expect(buildCloseLimitSubmission(closeLimitPosition, { price: "100", size: "2" })).toEqual({
      coin: "BTC",
      isLong: true,
      price: "100",
      size: "2",
    });
  });

  test("the close-limit modal closes only after the order is accepted", () => {
    expect(closeLimitAfterSubmit(closeLimitPosition, false)).toBe(closeLimitPosition);
    expect(closeLimitAfterSubmit(closeLimitPosition, true)).toBeNull();
  });
});
