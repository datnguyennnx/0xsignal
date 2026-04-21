import { describe, expect, it } from "vitest";
import { normalizeEventType } from "../policies";

describe("backtest policies", () => {
  it("keeps known event types unchanged", () => {
    expect(normalizeEventType("order_filled")).toBe("order_filled");
    expect(normalizeEventType("error")).toBe("error");
  });

  it("normalizes unknown event types to info", () => {
    expect(normalizeEventType("something_else")).toBe("info");
  });
});
