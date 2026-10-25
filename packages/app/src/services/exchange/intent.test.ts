/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type { OrderIntentRequest } from "@0xsignal/shared";
import {
  IntentHashMismatchError,
  assertIntentHash,
  canonicalIntent,
  computeIntentHash,
  formatConfirmation,
  summarizeIntent,
} from "./intent";

const input: OrderIntentRequest = {
  symbol: "BTC",
  side: "buy",
  size: "0.01",
  price: "50000",
  orderType: "limit",
  reduceOnly: false,
};

const rejectionOf = async (run: () => Promise<unknown>): Promise<Error | null> => {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

describe("intent hash", () => {
  test("canonical form matches the backend field order", () => {
    expect(canonicalIntent(input)).toBe(
      '{"symbol":"BTC","side":"buy","size":"0.01","price":"50000","orderType":"limit","timeInForce":null,"reduceOnly":false,"slippageBps":null,"leverage":null}',
    );
  });

  test("sha256 matches node:crypto for the canonical form", async () => {
    const expected = createHash("sha256").update(canonicalIntent(input)).digest("hex");
    expect(await computeIntentHash(input)).toBe(expected);
  });

  test("rejects a response whose hash differs from the local recomputation", async () => {
    const error = await rejectionOf(() =>
      assertIntentHash(input, {
        intentId: "intent-1",
        intentHash: "0".repeat(64),
        validated: {
          assetIndex: 0,
          symbol: "BTC",
          sizeDecimals: 5,
          priceDecimals: 1,
          notionalUsd: 500,
        },
      }),
    );
    expect(error).toBeInstanceOf(IntentHashMismatchError);
  });

  test("accepts a response carrying the locally computed hash", async () => {
    const intentHash = await computeIntentHash(input);
    const error = await rejectionOf(() =>
      assertIntentHash(input, {
        intentId: "intent-1",
        intentHash,
        validated: {
          assetIndex: 0,
          symbol: "BTC",
          sizeDecimals: 5,
          priceDecimals: 1,
          notionalUsd: 500,
        },
      }),
    );
    expect(error).toBeNull();
  });
});

describe("confirmation summary", () => {
  test("renders every signed field plus the connectionId", () => {
    const summary = summarizeIntent(input, {
      assetIndex: 3,
      symbol: "BTC",
      sizeDecimals: 5,
      priceDecimals: 1,
      notionalUsd: 500,
    });
    const text = formatConfirmation([summary], `0x${"ab".repeat(32)}`);
    expect(text).toContain("Market:      BTC");
    expect(text).toContain("Side:        BUY");
    expect(text).toContain("Size:        0.01");
    expect(text).toContain("Price:       50000");
    expect(text).toContain("Order type:  limit (GTC)");
    expect(text).toContain("Reduce only: no");
    expect(text).toContain(`connectionId: 0x${"ab".repeat(32)}`);
  });
});
