/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { normalizeSymbol, parseSymbol } from "./market-symbol";

describe("parseSymbol", () => {
  test("uppercases and trims perp symbols", () => {
    expect(parseSymbol("  btcusdt  ")).toEqual({ kind: "perp", coin: "BTC" });
    expect(parseSymbol("ethusd")).toEqual({ kind: "perp", coin: "ETH" });
  });

  test("keeps non-stablecoin hyphen suffixes on perps", () => {
    expect(parseSymbol("btc-perp")).toEqual({ kind: "perp", coin: "BTC-PERP" });
  });

  test("recognises stablecoin hyphen pairs as spot without changing case", () => {
    expect(parseSymbol("Purr-Usdc")).toEqual({ kind: "spot", coin: "Purr-Usdc", quote: "USDC" });
    expect(parseSymbol("eth-usdt")).toEqual({ kind: "spot", coin: "eth-usdt", quote: "USDT" });
  });

  test("passes slash pairs through as spot and uppercases the quote", () => {
    expect(parseSymbol("purr/usdc")).toEqual({ kind: "spot", coin: "purr/usdc", quote: "USDC" });
  });

  test("splits builder perp dex prefixes and uppercases the asset", () => {
    expect(parseSymbol("  XYZ:yeeti  ")).toEqual({
      kind: "builderPerp",
      coin: "xyz:YEETI",
      dex: "xyz",
    });
    expect(parseSymbol("XYZ:YEETI-USDT")).toEqual({
      kind: "builderPerp",
      coin: "xyz:YEETI",
      dex: "xyz",
    });
  });

  test("strips noise characters from perp symbols", () => {
    expect(parseSymbol("BT C!")).toEqual({ kind: "perp", coin: "BTC" });
  });

  test("returns an empty perp for blank input", () => {
    expect(parseSymbol("")).toEqual({ kind: "perp", coin: "" });
    expect(parseSymbol("   ")).toEqual({ kind: "perp", coin: "" });
  });
});

describe("normalizeSymbol", () => {
  test("returns the canonical perp coin", () => {
    expect(normalizeSymbol("  ethusdc  ")).toBe("ETH");
  });

  test("preserves spot identifiers", () => {
    expect(normalizeSymbol("PURR/USDC")).toBe("PURR/USDC");
  });

  test("returns the dex-prefixed builder coin", () => {
    expect(normalizeSymbol("xyz:yeeti")).toBe("xyz:YEETI");
  });
});
