/**
 * @hyperliquid-api POST /exchange (order path)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
 */

import { describe, expect, test } from "bun:test";
import {
  ExchangeClient,
  ExchangeError,
  MP_MAP,
  Signer,
  Transport,
  arr,
  asDecimal,
  cast,
  encode,
  obj,
  toWirePrice,
  toWireSize,
  type MpMap,
  type MpValue,
} from "../index";
import { encodeOrder, type OrderWire } from "./actions/index";
import { errorsOf } from "./response";

const valueAt = (m: MpMap, key: string): MpValue => {
  const pair = m.find(([k]) => k === key);
  if (pair === undefined) throw new Error(`missing key ${key}`);
  return pair[1];
};

const asMap = (value: unknown): MpMap => {
  if (!Array.isArray(value) || !(MP_MAP in value)) throw new Error("expected msgpack map");
  return cast<MpMap>(value, "msgpack map");
};

const bytesFromHex = (hex: string): Uint8Array => {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const PRIVATE_KEY = bytesFromHex(
  "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318",
);

const signer = new Signer({ privateKey: PRIVATE_KEY });

const requireFirst = <T>(items: readonly T[]): T => {
  const [first] = items;
  if (first === undefined) throw new Error("expected at least one item");
  return first;
};

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.catch((error: unknown) => error);

class FakeTransport extends Transport {
  readonly payload: unknown;
  readonly bodies: Record<string, unknown>[] = [];

  constructor(payload: unknown) {
    super({ retries: 0 });
    this.payload = payload;
  }

  override postExchange<T>(
    body: Record<string, unknown>,
    parse: (u: unknown) => T,
    _batchLength: number,
  ): Promise<T> {
    this.bodies.push(body);
    return Promise.resolve().then(() => parse(this.payload));
  }
}

const limitOrder = (): OrderWire => ({
  a: 4,
  b: true,
  p: toWirePrice(asDecimal("1100"), 5, "perp"),
  s: toWireSize(asDecimal("0.1"), 5),
  r: false,
  t: { limit: { tif: "Gtc" } },
});

describe("order wire path", () => {
  test("encodeOrder carries a WirePx as the msgpack string 1100", () => {
    const price = toWirePrice(asDecimal("1100"), 5, "perp");
    expect(Array.from(encode(price))).toEqual([0xa4, 0x31, 0x31, 0x30, 0x30]);

    const wire = encodeOrder({ orders: [limitOrder()], grouping: "na" });
    const orders = arr(valueAt(wire, "orders"), "orders");
    const firstOrder = asMap(orders[0]);
    expect(valueAt(firstOrder, "p")).toBe("1100");
  });

  test("an order built through toWirePrice posts the documented body", async () => {
    const transport = new FakeTransport({
      status: "ok",
      response: { type: "order", data: { statuses: ["success"] } },
    });
    const client = new ExchangeClient({ transport, signer });

    await client.order({ orders: [limitOrder()], grouping: "na" });

    const first = requireFirst(transport.bodies);
    const action = obj(first["action"], "action");
    expect(action["type"]).toBe("order");
    const firstOrder = obj(arr(action["orders"], "action.orders")[0], "action.orders[0]");
    expect(Object.keys(firstOrder)).toEqual(["a", "b", "p", "s", "r", "t"]);
  });
});

describe("ExchangeClient exchange errors", () => {
  const action = { orders: [limitOrder()], grouping: "na" as const };

  test("status err throws ExchangeError", async () => {
    const transport = new FakeTransport({
      status: "err",
      response: "Insufficient margin to place order.",
    });
    const client = new ExchangeClient({ transport, signer });

    expect(await rejectionOf(client.order(action))).toBeInstanceOf(ExchangeError);
  });

  test("a partial batch resolves and errorsOf returns the message", async () => {
    const transport = new FakeTransport({
      status: "ok",
      response: {
        type: "order",
        data: { statuses: [{ error: "Insufficient margin to place order." }, "success"] },
      },
    });
    const client = new ExchangeClient({ transport, signer });

    const result = await client.order(action);
    expect(result.status).toBe("ok");
    expect(errorsOf(result)).toEqual(["Insufficient margin to place order."]);
  });
});
