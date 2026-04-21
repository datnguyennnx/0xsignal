import { describe, expect, it } from "vitest";
import { getTimeframeMs, MARKET_TIMEFRAMES } from "../timeframe";

describe("market-data timeframe domain primitive", () => {
  it("defines canonical timeframe list", () => {
    expect(MARKET_TIMEFRAMES).toContain("1m");
    expect(MARKET_TIMEFRAMES).toContain("1w");
  });

  it("converts timeframe values to milliseconds", () => {
    expect(getTimeframeMs("1m")).toBe(60_000);
    expect(getTimeframeMs("1h")).toBe(3_600_000);
    expect(getTimeframeMs("1w")).toBe(604_800_000);
  });
});
