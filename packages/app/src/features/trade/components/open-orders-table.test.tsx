/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { renderMarkup } from "../../../../test/render";

import type { OpenOrder } from "@0xsignal/shared";

import { OpenOrdersTable } from "./open-orders-table";
import { areOpenOrderRowPropsEqual, type OpenOrderRowProps } from "./open-orders-table-logic";
import { TwapContent } from "./twap-content";

const takeProfit: OpenOrder = {
  coin: "BTC",
  side: "A",
  sz: "0.1",
  limitPx: "60000",
  oid: 2,
  timestamp: 1_700_000_000_000,
  origSz: "0.1",
  orderType: "Take Profit Market",
  triggerCondition: "Price above 60000",
  triggerPx: "60000",
  isTrigger: true,
  isPositionTpsl: true,
  reduceOnly: true,
  cloid: null,
};

const order: OpenOrder = {
  coin: "BTC",
  side: "B",
  sz: "0.1",
  limitPx: "62000",
  oid: 1,
  timestamp: 1_700_000_000_000,
  origSz: "0.1",
  orderType: "Limit",
  triggerCondition: "",
  triggerPx: "",
  isTrigger: false,
  isPositionTpsl: false,
  reduceOnly: false,
  cloid: null,
};

const renderTable = (readOnly: boolean, rows: readonly OpenOrder[] = [order]): string =>
  renderMarkup(
    <OpenOrdersTable
      isOoLoading={false}
      openOrders={[...rows]}
      onCancelOrder={() => {
        /* noop */
      }}
      onViewTpSl={() => {
        /* noop */
      }}
      onCancelAll={() => {
        /* noop */
      }}
      isCancelPending={false}
      orderCount={rows.length}
      readOnly={readOnly}
    />,
  );

describe("open orders read-only rendering", () => {
  test("a third party's table omits every mutating control", () => {
    const html = renderTable(true);

    expect(html).toContain("BTC");
    expect(html).not.toContain("Cancel All");
    expect(html).not.toContain(">Cancel<");
  });

  test("the own portfolio still renders its cancel control", () => {
    const html = renderTable(false);

    expect(html).toContain("Cancel All");
    expect(html).toContain(">Cancel<");
  });

  test("a position TP/SL order shows its role without a fabricated tree", () => {
    const html = renderTable(false, [takeProfit]);

    expect(html).toContain(">TP<");
    expect(html).not.toContain("View");
  });

  test("a row missing trigger fields degrades to a dash instead of crashing", () => {
    const html = renderTable(false, [order]);

    expect(html).toContain("BTC");
  });
});

describe("open orders with a missing order type", () => {
  const unknownOrder: OpenOrder = {
    coin: "ETH",
    side: "B",
    sz: "1",
    limitPx: "2000",
    oid: 3,
    timestamp: 1_700_000_000_000,
  };

  test("renders a fallback type instead of crashing the row", () => {
    const html = renderMarkup(
      <OpenOrdersTable
        isOoLoading={false}
        openOrders={[unknownOrder]}
        onCancelOrder={() => {
          /* noop */
        }}
        onViewTpSl={() => {
          /* noop */
        }}
        onCancelAll={() => {
          /* noop */
        }}
        isCancelPending={false}
        orderCount={1}
      />,
    );

    expect(html).toContain("ETH");
    expect(html).toContain("Unknown");
    expect(html).not.toContain("Unknown order type");
    expect(html).toContain(">—<");
  });
});

describe("tabs without a public reader", () => {
  test("TWAP renders an honest empty state, never a spinner", () => {
    const html = renderMarkup(<TwapContent readOnly />);

    expect(html).toContain("TWAP orders aren");
    expect(html).not.toContain("Loading");
    expect(html).not.toContain("Terminate");
  });
});

const noop = (): void => {};

const rowProps = (overrides: Partial<OpenOrderRowProps> = {}): OpenOrderRowProps => ({
  order,
  readOnly: false,
  isCancelPending: false,
  onCancelOrder: noop,
  onViewTpSl: noop,
  ...overrides,
});

describe("areOpenOrderRowPropsEqual", () => {
  test("keeps a row when every printed scalar matches across fresh objects", () => {
    const prev = rowProps();
    const freshOrder: OpenOrder = { ...order };
    const next = rowProps({ order: freshOrder });

    expect(prev.order).not.toBe(next.order);
    expect(areOpenOrderRowPropsEqual(prev, next)).toBe(true);
  });

  test("re-renders when a printed order field changes", () => {
    const prev = rowProps();
    const changes: Partial<OpenOrder>[] = [
      { oid: 99 },
      { coin: "ETH" },
      { side: "A" },
      { sz: "0.2" },
      { origSz: "0.3" },
      { limitPx: "63000" },
      { timestamp: 1_700_000_000_001 },
      { reduceOnly: true },
      { triggerCondition: "Price above 1" },
      { triggerPx: "1" },
      { orderType: "Stop Market" },
      { isTrigger: true },
      { isPositionTpsl: true },
    ];

    for (const change of changes) {
      expect(areOpenOrderRowPropsEqual(prev, rowProps({ order: { ...order, ...change } }))).toBe(
        false,
      );
    }
  });

  test("re-renders when the TP/SL role or row controls change", () => {
    const prev = rowProps();

    expect(areOpenOrderRowPropsEqual(prev, rowProps({ order: takeProfit }))).toBe(false);
    expect(areOpenOrderRowPropsEqual(prev, rowProps({ readOnly: true }))).toBe(false);
    expect(areOpenOrderRowPropsEqual(prev, rowProps({ isCancelPending: true }))).toBe(false);
    expect(areOpenOrderRowPropsEqual(prev, rowProps({ onCancelOrder: () => {} }))).toBe(false);
    expect(areOpenOrderRowPropsEqual(prev, rowProps({ onViewTpSl: () => {} }))).toBe(false);
  });
});

describe("open orders table culling and row markup", () => {
  test("opts into the shared table-cull contract", () => {
    expect(renderTable(false)).toContain("table-cull");
  });
});
