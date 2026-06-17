import { describe, expect, it } from "vitest";
import { buildMarketWsBucketKey } from "../bucket-key";

describe("market stream hub bucket key", () => {
  it("creates deterministic keys per channel payload", () => {
    expect(buildMarketWsBucketKey({ channel: "candle", symbol: "BTC", interval: "1m" })).toBe(
      "candle:BTC:1m",
    );
    expect(buildMarketWsBucketKey({ channel: "l2Book", symbol: "BTC", nSigFigs: 4 })).toBe(
      "l2Book:BTC:4",
    );
    expect(buildMarketWsBucketKey({ channel: "trades", symbol: "ETH" })).toBe("trades:ETH");
    expect(buildMarketWsBucketKey({ channel: "allMids", dex: "test" })).toBe("allMids:test");
  });
});
