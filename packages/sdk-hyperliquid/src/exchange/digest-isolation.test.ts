import { describe, expect, test } from "bun:test";
import { asDecimal } from "../core/brands";
import { cast } from "../core/parse";
import { Transport } from "../core/transport";
import { toWirePrice, toWireSize } from "../core/trade-rules";
import { Signer } from "../signing";
import type { OrderWire } from "./actions/order-wire";
import { ExchangeClient, type DigestEnvelope } from "./client";

const PRIVATE_KEY_HEX = "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";

const bytesFromHex = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const signer = new Signer({ privateKey: bytesFromHex(PRIVATE_KEY_HEX) });

const ORDER_RESPONSE = {
  status: "ok",
  response: { type: "order", data: { statuses: ["success"] } },
};

class FakeTransport extends Transport {
  readonly bodies: Record<string, unknown>[] = [];

  constructor() {
    super({ retries: 0 });
  }

  override postExchange<T>(
    body: Record<string, unknown>,
    parse: (u: unknown) => T,
    _batchLength: number,
  ): Promise<T> {
    this.bodies.push(body);
    return Promise.resolve().then(() => parse(ORDER_RESPONSE));
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

const orderAction = () => ({ orders: [limitOrder()], grouping: "na" as const });

describe("onDigest action isolation", () => {
  test("mutating the envelope action throws and leaves the posted body untouched", async () => {
    const transport = new FakeTransport();
    const envelopes: DigestEnvelope[] = [];
    const client = new ExchangeClient({
      transport,
      signer,
      onDigest: (_digest, envelope) => {
        envelopes.push(envelope);
      },
    });

    await client.order(orderAction());

    const envelope = cast<DigestEnvelope>(envelopes[0], "envelope");
    expect(Object.isFrozen(envelope.action)).toBe(true);
    const action = cast<Record<string, unknown>>(envelope.action, "envelope.action");
    expect(() => {
      action["tampered"] = true;
    }).toThrow();

    const body = cast<Record<string, unknown>>(transport.bodies[0], "body");
    expect(body["action"]).toEqual(envelope.action);
    expect(
      cast<Record<string, unknown>>(body["action"], "body.action")["tampered"],
    ).toBeUndefined();
  });
});
