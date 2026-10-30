/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { formatTradeRows } from "../lib/format-trade-rows";
import { splitDisplaySymbol } from "../utils/display-symbol";
import { getColumns } from "../utils/trade-dropdown-columns";

const SHAPES = ["BTC", "xyz:EUR", "HFUN/USDC"] as const;

const renderedSymbol = (symbol: string): string => {
  const { base, quote } = splitDisplaySymbol(symbol);
  return quote === "" ? base : `${base}-${quote}`;
};

describe("trigger symbol label", () => {
  test("every shape renders verbatim, with no dangling separator", () => {
    for (const symbol of SHAPES) {
      expect(renderedSymbol(symbol)).toBe(symbol);
    }
  });

  test("a perp quote suffix still renders apart from the base", () => {
    expect(splitDisplaySymbol("BTC-USDC")).toEqual({ base: "BTC", quote: "USDC" });
  });

  test("pair labels are a no-op, never truncated at a hyphen", () => {
    expect(splitDisplaySymbol("HFUN/USDC")).toEqual({ base: "HFUN/USDC", quote: "" });
    expect(splitDisplaySymbol("USD-T/USDC")).toEqual({ base: "USD-T/USDC", quote: "" });
  });
});

describe("symbol column", () => {
  const render = getColumns("perp").find((col) => col.id === "symbol")!.render;

  test("every shape survives row formatting verbatim", () => {
    for (const symbol of SHAPES) {
      const [row] = formatTradeRows(
        [
          {
            coin: symbol,
            rawCoin: symbol,
            marketType: "perp",
            displaySymbol: symbol,
            displayCategory: "Crypto",
            dexPrefix: null,
            isHip3: false,
            category: "crypto",
            markPx: "1",
            prevDayPx: "1",
            openInterest: "0",
            funding: "0",
            dayNtlVlm: "0",
            szDecimals: 4,
          },
        ],
        symbol,
      );
      expect(render(row)).toBe(symbol);
    }
  });
});
