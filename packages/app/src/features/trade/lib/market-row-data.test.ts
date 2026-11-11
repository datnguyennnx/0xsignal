/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { market } from "../../../test/fixtures";
import { formatMarketCell } from "./format-trade-rows";
import { buildMarketRows, selectMarketRows, sortMarketRows } from "./market-row-data";

const rowsOf = (...markets: Parameters<typeof buildMarketRows>[0]) => buildMarketRows(markets).rows;

describe("buildMarketRows changePct", () => {
  test("prevDayPx at zero is unknown, not a division by zero", () => {
    const [row] = rowsOf(market({ markPx: "100", prevDayPx: "0" }));
    expect(row.changePct).toBeNull();
  });

  test("markPx at zero is unknown, not a false -100%", () => {
    const [row] = rowsOf(market({ markPx: "0", prevDayPx: "100" }));
    expect(row.changePct).toBeNull();
  });

  test("a negative markPx is unknown", () => {
    const [row] = rowsOf(market({ markPx: "-5", prevDayPx: "100" }));
    expect(row.changePct).toBeNull();
  });

  test("a normal move is a percentage computed once", () => {
    const [row] = rowsOf(market({ markPx: "110", prevDayPx: "100" }));
    expect(row.changePct).toBeCloseTo(10);
  });

  test("a null change renders the placeholder through the real cell formatter", () => {
    const [row] = rowsOf(market({ markPx: "0", prevDayPx: "100" }));
    expect(formatMarketCell(row, "change", 0)).toBe("—");
    expect(formatMarketCell(row, "change", 0)).not.toBe("-100%");
  });
});

describe("buildMarketRows market badges", () => {
  test("maxLeverage and dexPrefix are copied from the asset", () => {
    const [row] = rowsOf(market({ maxLeverage: 20, dexPrefix: "xyz" }));
    expect(row.maxLeverage).toBe(20);
    expect(row.dexPrefix).toBe("xyz");
  });

  test("a market without a dex keeps a null prefix", () => {
    const [row] = rowsOf(market({ dexPrefix: null }));
    expect(row.dexPrefix).toBeNull();
  });
});

describe("buildMarketRows key and search keys", () => {
  test("the key is stable across snapshots of the same market", () => {
    const [first] = rowsOf(market({ rawCoin: "xyz:ABC", marketType: "perp" }));
    const [second] = rowsOf(market({ rawCoin: "xyz:ABC", marketType: "perp" }));
    expect(first.key).toBe(second.key);
    expect(first.key).toBe("perp:xyz:ABC");
  });

  test("the same raw coin on another market type is a different key", () => {
    const { rows } = buildMarketRows([
      market({ rawCoin: "@1", marketType: "spot" }),
      market({ rawCoin: "@1", marketType: "perp" }),
    ]);
    expect(rows[0].key).not.toBe(rows[1].key);
  });

  test("searchKeys carry the separator-stripped pair alias", () => {
    const { searchKeys } = buildMarketRows([market({ displaySymbol: "BTC-USDT", rawCoin: "BTC" })]);
    expect(searchKeys[0]).toContain("btcusdt");
  });
});

describe("sortMarketRows", () => {
  const mixed = () =>
    rowsOf(
      market({ coin: "AAA", markPx: "110", prevDayPx: "100" }),
      market({ coin: "BBB", markPx: "0", prevDayPx: "100" }),
      market({ coin: "CCC", markPx: "90", prevDayPx: "100" }),
    );

  test("ascending keeps an unknown change last", () => {
    expect(sortMarketRows(mixed(), "change", false).map((row) => row.coin)).toEqual([
      "CCC",
      "AAA",
      "BBB",
    ]);
  });

  test("descending also keeps an unknown change last", () => {
    expect(sortMarketRows(mixed(), "change", true).map((row) => row.coin)).toEqual([
      "AAA",
      "CCC",
      "BBB",
    ]);
  });

  test("names sort on the raw coin with the legacy comparator", () => {
    expect(sortMarketRows(mixed(), "name", false).map((row) => row.coin)).toEqual([
      "AAA",
      "BBB",
      "CCC",
    ]);
  });
});

describe("selectMarketRows", () => {
  test("search matches the existing alias query", () => {
    const rows = buildMarketRows([
      market({
        coin: "@1",
        rawCoin: "@1",
        displaySymbol: "PURR/USDC",
        name: "PURR/USDC",
        marketType: "spot",
        category: "spot",
      }),
      market({ coin: "HYPE", rawCoin: "HYPE", displaySymbol: "HYPE-USDC" }),
    ]);

    expect(
      selectMarketRows(rows, "all", "  purr usdc  ", "name", false).map((row) => row.coin),
    ).toEqual(["@1"]);
  });

  test("trending caps at ten by volume before searching", () => {
    const markets = Array.from({ length: 12 }, (_, index) =>
      market({
        coin: `COIN${index}`,
        rawCoin: `COIN${index}`,
        displaySymbol: `COIN${index}-USDC`,
        dayNtlVlm: String((index + 1) * 1000),
      }),
    );
    const rows = selectMarketRows(buildMarketRows(markets), "trending", "", "name", false);
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.coin)).not.toContain("COIN0");
    expect(rows.map((row) => row.coin)).not.toContain("COIN1");
  });

  test("the live filter drops zero-volume and non-numeric volume rows", () => {
    const rows = buildMarketRows([
      market({ coin: "LIVE", rawCoin: "LIVE" }),
      market({ coin: "DEAD", rawCoin: "DEAD", dayNtlVlm: "0" }),
      market({ coin: "BAD", rawCoin: "BAD", dayNtlVlm: "not-a-number" }),
    ]);
    expect(selectMarketRows(rows, "all", "", "name", false).map((row) => row.coin)).toEqual([
      "LIVE",
    ]);
  });
});

/** One live market per tab so counts pin the legacy filter semantics exactly. */
const FIXTURE = [
  market({
    coin: "BTC",
    rawCoin: "BTC",
    displaySymbol: "BTC-USDC",
    name: "Bitcoin",
    category: "crypto",
  }),
  market({
    coin: "ETH",
    rawCoin: "ETH",
    displaySymbol: "ETH-USDC",
    name: "Ethereum",
    category: "crypto",
    assetId: 1,
  }),
  market({
    coin: "@1",
    rawCoin: "@1",
    displaySymbol: "PURR/USDC",
    name: "PURR/USDC",
    marketType: "spot",
    category: "spot",
    assetId: 2,
  }),
  market({
    coin: "AAPL",
    rawCoin: "AAPL",
    displaySymbol: "AAPL-USDC",
    name: "Apple",
    category: "stocks",
    assetId: 3,
  }),
  market({
    coin: "xyz:A5",
    rawCoin: "xyz:A5",
    displaySymbol: "A5-USD",
    name: "Asset Five",
    category: "crypto",
    isHip3: true,
    assetId: 4,
  }),
  market({
    coin: "SPACEX",
    rawCoin: "SPACEX",
    displaySymbol: "SPACEX-USDC",
    name: "SpaceX",
    category: "preipo",
    assetId: 5,
  }),
] as const;

describe("selectMarketRows tab parity", () => {
  const count = (tab: Parameters<typeof selectMarketRows>[1]): number =>
    selectMarketRows(buildMarketRows(FIXTURE), tab, "", "name", false).length;

  test("each tab keeps the legacy category membership", () => {
    expect(count("perps")).toBe(5);
    expect(count("spot")).toBe(1);
    expect(count("tradfi")).toBe(1);
    expect(count("hip3")).toBe(1);
    expect(count("crypto")).toBe(3);
    expect(count("prelaunch")).toBe(1);
  });
});

describe("selectMarketRows search parity", () => {
  test("a plain symbol finds its market", () => {
    const rows = selectMarketRows(buildMarketRows(FIXTURE), "all", "btc", "name", false);
    expect(rows.map((row) => row.displaySymbol)).toEqual(["BTC-USDC"]);
  });

  test("a separator-stripped builder pair finds its market", () => {
    const rows = selectMarketRows(buildMarketRows(FIXTURE), "all", "xyz:a5", "name", false);
    expect(rows.map((row) => row.rawCoin)).toEqual(["xyz:A5"]);
  });
});
