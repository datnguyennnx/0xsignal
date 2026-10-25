import { describe, expect, it } from "vitest";
import { normalizeL2BookData } from "../normalizers";

describe("hyperliquid stream normalizers", () => {
  it("extracts orderbook levels from known nesting forms", () => {
    expect(normalizeL2BookData({ data: { levels: [[{ px: "1" }], [{ px: "2" }]] } })).toEqual({
      levels: [[{ px: "1" }], [{ px: "2" }]],
    });

    expect(normalizeL2BookData({ payload: { l2Book: { levels: [[], []] } } })).toEqual({
      levels: [[], []],
    });
  });
});
