/// <reference types="bun-types" />
import { describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { Tabs } from "@/components/ui/tabs";

mock.module("wagmi", () => ({
  useConnection: () => ({ isConnected: false }),
  useConnect: () => ({ mutate: () => {}, isPending: false }),
  useConnectors: () => [],
  useDisconnect: () => ({ mutate: () => {} }),
}));

const { PositionManagementPanels } = await import("./position-management-panels");

const WHALE = "0x0000000000000000000000000000000000000002";

const noop = (): void => {};

const panelClassOf = (html: string): string =>
  /data-slot="tabs-content" class="([^"]*)"/.exec(html)?.[1] ?? "";

const renderReadOnlyPanel = (value: string): string => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
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
    expect(panelClassOf(positions)).not.toContain("pointer-events-none");
    expect(panelClassOf(openOrders)).not.toContain("pointer-events-none");
    expect(positions).not.toContain("Connect a wallet to trade");
    expect(openOrders).not.toContain("Connect a wallet to trade");
  });
});
