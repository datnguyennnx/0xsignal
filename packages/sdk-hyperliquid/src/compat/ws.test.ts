import { describe, expect, test } from "bun:test";
import { CHANNEL_OF, decodeData, subscribeFrame, unsubscribeFrame } from "../ws/channels";
import type { Subscription } from "../ws/types";

const FAST_ASSET_CTXS_VECTOR =
  "q1ZyCnFWsqpWyk0syg6oULJSsjQ3NTDQM1Wq1VFyDfFAkTI2MzXQMwJLVVRWWfmFuTiiyBuamOoZKdXWAgA=";

describe("websocket channel map", () => {
  test("CHANNEL_OF has exactly 24 entries", () => {
    expect(Object.keys(CHANNEL_OF).length).toBe(24);
  });

  test("userEvents maps to the user wire channel", () => {
    expect(CHANNEL_OF.userEvents).toBe("user");
  });

  test("every other channel maps to itself", () => {
    const others = Object.entries(CHANNEL_OF).filter(([name]) => name !== "userEvents");
    for (const [name, wire] of others) {
      expect(wire === name).toBe(true);
    }
  });

  test("userEvents wire channel is user", () => {
    expect(CHANNEL_OF.userEvents).toBe("user");
  });
});

describe("websocket frame shapes", () => {
  const subscription: Subscription = { type: "l2Book", coin: "BTC" };

  test("subscribeFrame wraps the subscription under method subscribe", () => {
    expect(subscribeFrame(subscription)).toEqual({
      method: "subscribe",
      subscription,
    });
  });

  test("unsubscribeFrame wraps the subscription under method unsubscribe", () => {
    expect(unsubscribeFrame(subscription)).toEqual({
      method: "unsubscribe",
      subscription,
    });
  });
});

describe("websocket data decoding", () => {
  test("a normal channel passes its data through unchanged", () => {
    const data = { coin: "BTC", levels: [[], []], time: 1 };
    expect(decodeData(CHANNEL_OF.l2Book, data)).toBe(data);
  });

  test("fastAssetCtxs returns a promise that resolves the decoded contexts", async () => {
    const decoded = decodeData(CHANNEL_OF.fastAssetCtxs, FAST_ASSET_CTXS_VECTOR);
    expect(decoded).toBeInstanceOf(Promise);
    expect(await Promise.resolve(decoded)).toEqual({
      BTC: { markPx: 97500.5 },
      ETH: { markPx: 3650.25 },
      "xyz:NVDA": { markPx: 145.2 },
    });
  });
});
