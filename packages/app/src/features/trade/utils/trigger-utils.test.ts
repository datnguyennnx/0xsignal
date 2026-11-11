/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { OpenOrder } from "@0xsignal/shared";

import { getOrderType, resolveTriggerCondition, buildTpSlByCoinMap } from "./trigger-utils";

function makeOrder(overrides: Partial<OpenOrder> = {}): OpenOrder {
  return {
    coin: "BTC",
    side: "B",
    sz: "1",
    limitPx: "50000",
    oid: 1,
    timestamp: 0,
    ...overrides,
  };
}

describe("getOrderType", () => {
  const objectOrderTypes: ReadonlyArray<[Record<string, unknown>, string]> = [
    [{ limit: {} }, "Limit"],
    [{ algo: {} }, "Algo"],
    [{ ioc: {} }, "IOC"],
  ];

  for (const [orderType, expected] of objectOrderTypes) {
    test(`an object order type ${JSON.stringify(orderType)} maps to ${expected}`, () => {
      expect(getOrderType(makeOrder({ orderType }))).toBe(expected);
    });
  }

  test("a plain limit order yields Limit", () => {
    expect(getOrderType(makeOrder({ orderType: { limit: { tif: "Gtc" } } }))).toBe("Limit");
  });

  test("a trigger order resolves to Stop Market or Take Profit Market by condition", () => {
    expect(
      getOrderType(makeOrder({ orderType: { trigger: {} }, side: "B", triggerCondition: "above" })),
    ).toBe("Stop Market");
    expect(
      getOrderType(makeOrder({ orderType: { trigger: {} }, side: "A", triggerCondition: "above" })),
    ).toBe("Take Profit Market");
  });

  test("an unknown object order type maps to the fallback instead of throwing", () => {
    expect(getOrderType(makeOrder({ orderType: { bogus: {} } }))).toBe("Unknown");
  });

  test("a missing order type maps to the fallback instead of throwing", () => {
    expect(getOrderType(makeOrder())).toBe("Unknown");
  });

  test("a null order type maps to the fallback instead of throwing", () => {
    const nullTyped: OpenOrder = makeOrder();
    Object.assign(nullTyped, { orderType: null });
    expect(getOrderType(nullTyped)).toBe("Unknown");
  });

  test("a missing order type with trigger evidence stays a trigger order", () => {
    expect(getOrderType(makeOrder({ isTrigger: true, side: "B", triggerCondition: "above" }))).toBe(
      "Stop Market",
    );
    expect(getOrderType(makeOrder({ triggerPx: "50000", side: "A" }))).toBe("Stop Market");
  });
});

describe("resolveTriggerCondition", () => {
  test("a trigger order infers above for buys and below for sells", () => {
    expect(resolveTriggerCondition(makeOrder({ orderType: { trigger: {} }, side: "B" }))).toBe(
      "above",
    );
    expect(resolveTriggerCondition(makeOrder({ orderType: { trigger: {} }, side: "A" }))).toBe(
      "below",
    );
  });

  test("a take-profit order infers below for buys and above for sells", () => {
    expect(resolveTriggerCondition(makeOrder({ orderType: "Take Profit Market", side: "B" }))).toBe(
      "below",
    );
    expect(resolveTriggerCondition(makeOrder({ orderType: "Take Profit Market", side: "A" }))).toBe(
      "above",
    );
  });
});

describe("buildTpSlByCoinMap", () => {
  test("groups position TP/SL trigger orders onto their coin", () => {
    const orders: OpenOrder[] = [
      makeOrder({
        oid: 1,
        coin: "BTC",
        orderType: "Take Profit Market",
        isTrigger: true,
        isPositionTpsl: true,
        limitPx: "0",
        triggerPx: "70000",
      }),
      makeOrder({
        oid: 2,
        coin: "BTC",
        orderType: "Stop Market",
        isTrigger: true,
        isPositionTpsl: true,
        limitPx: "0",
        triggerPx: "55000",
      }),
    ];

    expect(buildTpSlByCoinMap(orders)).toEqual({
      BTC: { tp: "$70,000.00", sl: "$55,000.00" },
    });
  });

  test("ignores plain limits and orders without the position flags", () => {
    const orders: OpenOrder[] = [
      makeOrder({ oid: 1, coin: "BTC", orderType: "Limit" }),
      makeOrder({ oid: 2, coin: "ETH", orderType: "Stop Market", isTrigger: true }),
    ];

    expect(buildTpSlByCoinMap(orders)).toEqual({});
    expect(buildTpSlByCoinMap(undefined)).toEqual({});
  });
});
