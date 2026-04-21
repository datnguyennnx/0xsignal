import { describe, expect, it } from "vitest";
import {
  normalizeAllMidsData,
  normalizeCandleData,
  normalizeL2BookData,
  normalizeTradesData,
} from "../normalizers";

describe("hyperliquid stream normalizers", () => {
  it("unwraps nested payload/data wrappers", () => {
    const candle = normalizeCandleData({ payload: { data: { t: 1 } } });
    const trades = normalizeTradesData({ data: [{ px: "10" }] });
    const allMids = normalizeAllMidsData({ payload: { BTC: "100" } });

    expect(candle).toEqual({ t: 1 });
    expect(trades).toEqual([{ px: "10" }]);
    expect(allMids).toEqual({ BTC: "100" });
  });

  it("extracts orderbook levels from known nesting forms", () => {
    expect(normalizeL2BookData({ data: { levels: [[{ px: "1" }], [{ px: "2" }]] } })).toEqual({
      levels: [[{ px: "1" }], [{ px: "2" }]],
    });

    expect(normalizeL2BookData({ payload: { l2Book: { levels: [[], []] } } })).toEqual({
      levels: [[], []],
    });
  });
});
