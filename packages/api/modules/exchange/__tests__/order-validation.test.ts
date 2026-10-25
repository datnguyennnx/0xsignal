import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { OrderValidationInput } from "../order-validation";
import { buildCoinToAsset, validateOrderInput } from "../order-validation";
import { HyperliquidValidationError, makeMetaResponse } from "./helpers";

const coinToAsset = buildCoinToAsset(makeMetaResponse(["BTC"]));

const baseOrder: OrderValidationInput = {
  symbol: "BTC",
  side: "buy",
  quantity: "0.5",
  price: "100",
  reduceOnly: false,
  orderType: { kind: "limit", timeInForce: "GTC" },
};

const rejected = (input: OrderValidationInput) =>
  Effect.runPromise(validateOrderInput(input, coinToAsset).pipe(Effect.flip));

describe("shared order validation", () => {
  it("rejects a zero price unless it is a reduce-only market close", async () => {
    const error = await rejected({ ...baseOrder, price: "0" });

    expect(error).toBeInstanceOf(HyperliquidValidationError);
    expect(error.message).toContain("price must be > 0");
  });

  it("accepts a zero price for a reduce-only market close", async () => {
    const validated = await Effect.runPromise(
      validateOrderInput(
        {
          ...baseOrder,
          price: "0",
          reduceOnly: true,
          orderType: { kind: "limit", timeInForce: "FrontendMarket" },
        },
        coinToAsset,
      ),
    );

    expect(validated.price).toBe("0");
    expect(validated.reduceOnly).toBe(true);
  });

  it("rejects an unknown symbol", async () => {
    const error = await rejected({ ...baseOrder, symbol: "NOPE" });

    expect(error).toBeInstanceOf(HyperliquidValidationError);
    expect(error.message).toContain("Symbol not supported");
  });

  it("maps a valid order to the Hyperliquid shape", async () => {
    const validated = await Effect.runPromise(validateOrderInput(baseOrder, coinToAsset));

    expect(validated).toEqual({
      assetIndex: 0,
      isBuy: true,
      price: "100",
      size: "0.5",
      reduceOnly: false,
      hyperliquidType: { limit: { tif: "Gtc" } },
    });
  });
});
