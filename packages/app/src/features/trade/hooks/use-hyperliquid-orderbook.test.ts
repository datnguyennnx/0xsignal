import { describe, expect, test } from "bun:test";
import { orderbookSeedQueryKey } from "./use-hyperliquid-orderbook";
import { orderbookStoreKey } from "../lib/orderbook-book";

describe("orderbookSeedQueryKey", () => {
  test("the same symbol and precision yield the same key", () => {
    expect(orderbookSeedQueryKey("BTC", 5)).toEqual(orderbookSeedQueryKey("BTC", 5));
    expect(orderbookSeedQueryKey("BTC", null)).toEqual(orderbookSeedQueryKey("BTC", null));
  });

  test("a different precision yields a different key", () => {
    const five = orderbookSeedQueryKey("BTC", 5);
    const three = orderbookSeedQueryKey("BTC", 3);
    const raw = orderbookSeedQueryKey("BTC", null);

    expect(five).not.toEqual(three);
    expect(three).not.toEqual(raw);
    expect(five).not.toEqual(raw);
  });

  test("the key carries the symbol", () => {
    expect(orderbookSeedQueryKey("BTC", 5)).not.toEqual(orderbookSeedQueryKey("ETH", 5));
    expect(orderbookSeedQueryKey("BTC", 5)).toContain("BTC:5");
  });

  test("the seed key ends with the store key the stream writes", () => {
    expect(orderbookSeedQueryKey("BTC", 5).at(-1)).toBe(orderbookStoreKey("BTC", 5));
    expect(orderbookSeedQueryKey("BTC", null).at(-1)).toBe(orderbookStoreKey("BTC", null));
  });
});
