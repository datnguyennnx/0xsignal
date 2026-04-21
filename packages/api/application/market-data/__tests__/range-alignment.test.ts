import { describe, expect, it } from "vitest";
import { alignRangeToTimeframe } from "../range-alignment";

describe("market-data range alignment", () => {
  it("aligns start upward and end downward to timeframe boundaries", () => {
    const start = new Date("2026-01-01T00:00:31.000Z");
    const end = new Date("2026-01-01T00:05:29.000Z");

    const result = alignRangeToTimeframe("1m", start, end);
    expect(result.startTime.toISOString()).toBe("2026-01-01T00:01:00.000Z");
    expect(result.endTime.toISOString()).toBe("2026-01-01T00:05:00.000Z");
  });
});
