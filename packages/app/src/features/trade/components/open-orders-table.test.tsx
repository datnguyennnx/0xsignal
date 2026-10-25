/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { FrontendOpenOrder } from "@0xsignal/shared";

import { OpenOrdersTable } from "./open-orders-table";
import { TwapContent } from "./twap-content";

const child: FrontendOpenOrder = {
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
  children: [],
  cloid: null,
  tif: "Gtc",
};

const order: FrontendOpenOrder = {
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
  children: [child],
  cloid: null,
  tif: "Gtc",
};

const renderTable = (readOnly: boolean): string =>
  renderToStaticMarkup(
    <OpenOrdersTable
      isOoLoading={false}
      openOrders={[order]}
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
      readOnly={readOnly}
    />,
  );

describe("open orders read-only rendering", () => {
  test("a third party's table omits every mutating control", () => {
    const html = renderTable(true);

    expect(html).toContain("BTC");
    expect(html).not.toContain("Cancel All");
    expect(html).not.toContain(">Cancel<");
    expect(html).not.toContain(">View<");
  });

  test("the own portfolio still renders its cancel and TP/SL controls", () => {
    const html = renderTable(false);

    expect(html).toContain("Cancel All");
    expect(html).toContain(">Cancel<");
    expect(html).toContain(">View<");
  });
});

describe("tabs without a public reader", () => {
  test("TWAP renders an honest empty state, never a spinner", () => {
    const html = renderToStaticMarkup(<TwapContent readOnly />);

    expect(html).toContain("TWAP orders aren");
    expect(html).not.toContain("Loading");
    expect(html).not.toContain("Terminate");
  });
});
