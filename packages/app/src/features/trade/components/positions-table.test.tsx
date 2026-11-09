/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { useMarketDataStore } from "@/stores/use-market-data-store";

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

/**
 * React's server renderer reads zustand's *initial* snapshot, so seed it for the
 * duration of one render and restore it afterwards.
 */
const withInitialMids = <T,>(mids: Record<string, number>, run: () => T): T => {
  const initial = useMarketDataStore.getInitialState();
  const previous = initial.allMids;
  initial.allMids = mids;
  try {
    return run();
  } finally {
    initial.allMids = previous;
  }
};

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

describe("positions table per-coin mid", () => {
  test("a row reads its own mid from the per-coin selector", () => {
    const html = withInitialMids({ BTC: 30000, ETH: 2000 }, () => renderTable(false));

    expect(html).toContain("$30,000.00");
    expect(html).not.toContain("$24,100.00");
    expect(html).not.toContain("$2,000.00");
  });

  test("a tick for another coin leaves the selected mid untouched", () => {
    useMarketDataStore.setState({ allMids: { BTC: 30000, ETH: 2000 } });
    const seen: number[] = [];
    const unsubscribe = useMarketDataStore.subscribe(
      (state) => state.allMids.BTC,
      (mid) => {
        seen.push(mid);
      },
    );

    useMarketDataStore.setState({ allMids: { BTC: 30000, ETH: 2001 } });
    expect(seen).toEqual([]);

    useMarketDataStore.setState({ allMids: { BTC: 30100, ETH: 2001 } });
    expect(seen).toEqual([30100]);

    unsubscribe();
    useMarketDataStore.setState({ allMids: {} });
  });
});
