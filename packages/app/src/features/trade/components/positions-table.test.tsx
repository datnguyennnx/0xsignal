/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { PositionsTable, type PositionRow } from "./positions-table";

const positions: PositionRow[] = [
  {
    position: {
      coin: "BTC",
      szi: "10",
      entryPx: "24000",
      positionValue: "25000",
      liquidationPx: null,
      marginUsed: "1000",
      unrealizedPnl: "1000",
      returnOnEquity: "0.1",
      cumFunding: { sinceOpen: "0" },
      leverage: { type: "cross", value: 10 },
    },
  },
];

const renderTable = (readOnly: boolean): string =>
  renderToStaticMarkup(
    <MemoryRouter>
      <PositionsTable isChLoading={false} positions={positions} readOnly={readOnly} />
    </MemoryRouter>,
  );

describe("positions table read-only rendering", () => {
  test("a third party's table has no action column or close controls", () => {
    const html = renderTable(true);

    expect(html).toContain("Mark Price");
    expect(html).not.toContain("Close All");
    expect(html).not.toContain("TP/SL");
    expect(html).not.toContain(">Market<");
    expect(html).not.toContain(">Limit<");
  });

  test("the own portfolio still renders its close actions", () => {
    const html = renderTable(false);

    expect(html).toContain("Close All");
    expect(html).toContain("TP/SL");
    expect(html).toContain(">Market<");
    expect(html).toContain(">Limit<");
  });
});
