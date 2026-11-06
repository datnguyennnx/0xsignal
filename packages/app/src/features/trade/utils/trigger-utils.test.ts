/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { OpenOrder } from "@0xsignal/shared";

import { getOrderType, resolveTriggerCondition } from "./trigger-utils";

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

  test("an unknown object order type throws a message naming the keys", () => {
    expect(() => getOrderType(makeOrder({ orderType: { bogus: {} } }))).toThrow(
      "Unknown order type: bogus",
    );
  });

  test("a missing order type throws instead of defaulting to Limit", () => {
    expect(() => getOrderType(makeOrder())).toThrow("Unknown order type: undefined");
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
