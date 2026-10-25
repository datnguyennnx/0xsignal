import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { PlaceOrderEntry, PlaceOrderRequest } from "@0xsignal/shared";
import { buildExchangeRoutes, type ExchangeHttpService } from "../../../modules/exchange/http";
import { asHttpError } from "../../../platform/http/error-response";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const submit = (payload: unknown) => {
  const captured: PlaceOrderRequest[] = [];
  const exchange: ExchangeHttpService = {
    placeOrder: (params) =>
      Effect.sync(() => {
        captured.push(params);
        return { status: "ok" };
      }),
    updateLeverageAndMargin: () => Effect.die(new Error("unexpected updateLeverage")),
    cancelOrders: () => Effect.die(new Error("unexpected cancelOrders")),
  };
  const [route] = buildExchangeRoutes({
    json,
    mapServiceError: (error) => asHttpError(502, String(error)),
  });
  const url = "http://localhost/api/exchange/order";
  const effect = route.handler(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    new URL(url),
    exchange,
    "user-1",
  );
  return { captured, effect };
};

const accepted = async (payload: unknown) => {
  const { captured, effect } = submit(payload);
  const response = await Effect.runPromise(effect);
  return { response, captured };
};

const rejected = (payload: unknown) => Effect.runPromise(submit(payload).effect.pipe(Effect.flip));

const order = (overrides: Partial<PlaceOrderEntry> = {}): PlaceOrderEntry => ({
  symbol: "BTC",
  side: "sell",
  quantity: "0.5",
  price: "0",
  reduceOnly: true,
  orderType: { kind: "limit", timeInForce: "FrontendMarket" },
  ...overrides,
});

describe("POST /api/exchange/order schema", () => {
  it("accepts price 0 for a reduce-only market close", async () => {
    const { response, captured } = await accepted({ orders: [order()] });

    expect(response.status).toBe(200);
    expect(captured[0].orders[0].price).toBe("0");
  });

  it("accepts non-negative prices", async () => {
    const { response, captured } = await accepted({
      orders: [
        order({ price: "0.001", reduceOnly: false }),
        order({ price: "1500", reduceOnly: false }),
        order({ price: "0.00" }),
      ],
    });

    expect(response.status).toBe(200);
    expect(captured[0].orders.map((o) => o.price)).toEqual(["0.001", "1500", "0.00"]);
  });

  it.each(["-1", "1e-3", "abc", ""])("rejects price %j", async (price) => {
    const error = await rejected({ orders: [order({ price })] });

    expect(error.status).toBe(400);
  });

  it.each(["0", "0.0"])("rejects quantity %j", async (quantity) => {
    const error = await rejected({ orders: [order({ quantity })] });

    expect(error.status).toBe(400);
  });
});
