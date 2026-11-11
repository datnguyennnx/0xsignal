import { describe, expect, test } from "bun:test";

import { asDecimal, type DecimalString } from "@0xsignal/sdk-hyperliquid";
import type { WsActiveAssetCtx } from "@0xsignal/sdk-hyperliquid/subscription";

import { parseAssetCtx } from "./asset-ctx";

const captured: WsActiveAssetCtx["ctx"] = {
  dayNtlVlm: asDecimal("563592476.12"),
  prevDayPx: asDecimal("92620.0"),
  markPx: asDecimal("93732.0"),
  midPx: asDecimal("93731.5"),
  funding: asDecimal("0.00000625"),
  openInterest: asDecimal("2175.0"),
  oraclePx: asDecimal("93730.0"),
};

const withoutMarkPx = (): WsActiveAssetCtx["ctx"] => {
  const ctx = { ...captured };
  Reflect.deleteProperty(ctx, "markPx");
  return ctx;
};

describe("parseAssetCtx", () => {
  test("parses a captured frame into exact numbers", () => {
    expect(parseAssetCtx(captured)).toEqual({
      markPx: 93732,
      prevDayPx: 92620,
      funding: 0.00000625,
      dayNtlVlm: 563592476.12,
      openInterest: 2175,
      oraclePx: 93730,
    });
  });

  test("rejects a zero previous-day price instead of returning a useless change", () => {
    expect(parseAssetCtx({ ...captured, prevDayPx: asDecimal("0") })).toBeNull();
  });

  test("rejects a frame with no mark price", () => {
    expect(parseAssetCtx(withoutMarkPx())).toBeNull();
  });

  test("rejects a non-numeric mark price", () => {
    expect(parseAssetCtx({ ...captured, markPx: "not-a-price" as DecimalString })).toBeNull();
  });

  test("falls back to the mark price when the oracle price is unusable", () => {
    const parsed = parseAssetCtx({ ...captured, oraclePx: "n/a" as DecimalString });
    expect(parsed?.oraclePx).toBe(93732);
  });
});
