import { describe, expect, it } from "vitest";
import { mapToHLInterval } from "./hyperliquid";

describe("mapToHLInterval", () => {
  it("keeps supported intervals", () => {
    expect(mapToHLInterval("1m")).toBe("1m");
    expect(mapToHLInterval("3m")).toBe("3m");
    expect(mapToHLInterval("1w")).toBe("1w");
  });

  it("falls back for unsupported long intervals", () => {
    expect(mapToHLInterval("3d")).toBe("1h");
    expect(mapToHLInterval("1M")).toBe("1h");
  });
});
