import { describe, expect, it } from "vitest";
import { getMarketsSnapshot, mapTickerFromSnapshot } from "../mapping";

describe("hyperliquid mapping", () => {
  it("merges perp categories with fallback universe symbols", async () => {
    const info = {
      metaAndAssetCtxs: async () =>
        [
          { universe: [{ name: "BTC" }, { name: "ETH" }] },
          [{ midPx: "100" }, { midPx: "200" }],
        ] as [unknown, unknown],
      allMids: async () => ({ BTC: "100", ETH: "200" }),
      perpCategories: async () => [["BTC", "major"]],
    };

    const snapshot = await getMarketsSnapshot(info);
    expect(snapshot.perpCategories).toEqual([
      ["BTC", "major"],
      ["ETH", "crypto"],
    ]);
  });

  it("maps ticker using normalized symbol and allMids fallback", () => {
    const ticker = mapTickerFromSnapshot(
      {
        universe: [{ name: "BTC" }],
        assetCtxs: [],
        allMids: { BTC: "101.5" },
      },
      "btc"
    );

    expect(ticker.symbol).toBe("BTC");
    expect(ticker.mid).toBe(101.5);
    expect(ticker.markPx).toBe(101.5);
  });
});
