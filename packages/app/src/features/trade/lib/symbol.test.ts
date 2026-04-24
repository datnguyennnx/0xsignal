import { describe, expect, it } from "vitest";
import { normalizeSymbol } from "./symbol";

describe("symbol normalization", () => {
  it("normalizes regular perp symbols", () => {
    expect(normalizeSymbol(" btcusdt ")).toBe("BTC");
    expect(normalizeSymbol("eth-usdc")).toBe("ETH");
  });

  it("normalizes builder perp symbols with lowercase dex", () => {
    expect(normalizeSymbol("XYZ:clusdt")).toBe("xyz:CL");
    expect(normalizeSymbol(" xyz:CL ")).toBe("xyz:CL");
  });
});
