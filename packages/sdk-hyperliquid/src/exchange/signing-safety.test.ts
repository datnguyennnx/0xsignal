import { describe, expect, test } from "bun:test";
import { asAddress, asDecimal } from "../core/brands";
import { ExchangeError, ValidationError } from "../core/errors";
import { Transport } from "../core/transport";
import { toWirePrice, toWireSize } from "../core/trade-rules";
import { Signer, type BuilderPolicy } from "../signing";
import type { Builder, OrderWire } from "./actions/order-wire";
import { ExchangeClient, type DigestEnvelope } from "./client";

const PRIVATE_KEY_HEX = "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const VAULT = "0x1111111111111111111111111111111111111111";
const DESTINATION = asAddress("0x2222222222222222222222222222222222222222");
const EXPIRES_AFTER = 1_900_000_000;

const bytesFromHex = (hex: string): Uint8Array => {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const signer = new Signer({ privateKey: bytesFromHex(PRIVATE_KEY_HEX) });

const ORDER_RESPONSE = {
  status: "ok",
  response: { type: "order", data: { statuses: ["success"] } },
};

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

const orderAction = () => ({ orders: [limitOrder()], grouping: "na" as const });

const requireEnvelope = (envelopes: readonly DigestEnvelope[]): DigestEnvelope => {
  const [envelope] = envelopes;
  if (envelope === undefined) throw new Error("onDigest was not called");
  return envelope;
};

const requireBody = (bodies: readonly Record<string, unknown>[]): Record<string, unknown> => {
  const [body] = bodies;
  if (body === undefined) throw new Error("no exchange body was posted");
  return body;
};

describe("onDigest envelope completeness", () => {
  test("an L1 order envelope carries the full enumerable key set", async () => {
    const transport = new FakeTransport(ORDER_RESPONSE);
    const envelopes: DigestEnvelope[] = [];
    const client = new ExchangeClient({
      transport,
      signer,
      vaultAddress: VAULT,
      expiresAfter: EXPIRES_AFTER,
      onDigest: (_digest, envelope) => {
        envelopes.push(envelope);
      },
    });

    await client.order(orderAction());

    const envelope = requireEnvelope(envelopes);
    const body = requireBody(transport.bodies);
    expect(Object.keys(envelope).sort()).toEqual([
      "action",
      "connectionId",
      "expiresAfter",
      "isTestnet",
      "nonce",
      "source",
      "typedData",
      "vaultAddress",
    ]);
    for (const key of ["isTestnet", "source", "connectionId", "typedData"] as const) {
      expect(Object.getOwnPropertyDescriptor(envelope, key)?.enumerable).toBe(true);
    }
    expect(envelope.action).toEqual(body["action"]);
    expect(body["nonce"]).toBe(envelope.nonce);
    expect(envelope.vaultAddress).toBe(VAULT);
    expect(envelope.expiresAfter).toBe(EXPIRES_AFTER);
    expect(envelope.isTestnet).toBe(false);
    expect(envelope.source).toBe("a");
    expect(envelope.connectionId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(envelope.typedData.primaryType).toBe("Agent");
  });

  test("a user-signed envelope carries the full enumerable key set even with vault and expiry configured", async () => {
    const transport = new FakeTransport({ status: "ok", response: { type: "default" } });
    const envelopes: DigestEnvelope[] = [];
    const client = new ExchangeClient({
      transport,
      signer,
      vaultAddress: VAULT,
      expiresAfter: EXPIRES_AFTER,
      onDigest: (_digest, envelope) => {
        envelopes.push(envelope);
      },
    });
    const time = Date.now();

    await client.usdSend({
      destination: DESTINATION,
      amount: asDecimal("1"),
      time,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0x1",
    });

    const envelope = requireEnvelope(envelopes);
    const body = requireBody(transport.bodies);
    expect(Object.keys(envelope).sort()).toEqual([
      "action",
      "connectionId",
      "isTestnet",
      "nonce",
      "source",
      "typedData",
    ]);
    expect(envelope.nonce).toBe(time);
    expect(envelope.action).toEqual({
      type: "usdSend",
      destination: DESTINATION,
      amount: "1",
      time,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    });
    expect(body["nonce"]).toBe(time);
  });
});

const rejectionOf = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("expected rejection");
};

const TOP = asAddress("0x3333333333333333333333333333333333333333");
const SUB_ALLOWED = asAddress("0x4444444444444444444444444444444444444444");
const SUB_OTHER = asAddress("0x5555555555555555555555555555555555555555");
const SUB_UNKNOWN = asAddress("0x6666666666666666666666666666666666666666");

const clientFor = (builders: BuilderPolicy): ExchangeClient =>
  new ExchangeClient({ transport: new FakeTransport(ORDER_RESPONSE), signer, builders });

const orderWithBuilder = (builder: Builder) => ({
  ...orderAction(),
  builder,
});

const requireValidationError = (error: unknown): ValidationError => {
  expect(error).toBeInstanceOf(ValidationError);
  if (!(error instanceof ValidationError)) throw new Error("not a ValidationError");
  return error;
};

describe("sub-builder validation", () => {
  test("a builder order without an explicit policy is rejected", async () => {
    const builder: Builder = { b: TOP, f: 10 };
    const client = new ExchangeClient({
      transport: new FakeTransport(ORDER_RESPONSE),
      signer,
    });
    const error = requireValidationError(
      await rejectionOf(() => client.order(orderWithBuilder(builder))),
    );
    expect(error.path).toBe("builder.b");
  });

  test("a sub-builder address outside the allowlist is rejected with its index", async () => {
    const builders = new Map<string, number>([
      [TOP, 100],
      [SUB_ALLOWED, 10],
    ]);
    const builder: Builder = {
      b: TOP,
      f: 20,
      s: [
        { b: SUB_ALLOWED, s: 1 },
        { b: SUB_UNKNOWN, s: 1 },
      ],
    };
    const error = requireValidationError(
      await rejectionOf(() => clientFor(builders).order(orderWithBuilder(builder))),
    );
    expect(error.path).toBe("builder.s[1].b");
    expect(error.message).toContain("builder.s[1]");
  });

  test("a per-sub fee above the allowed value is rejected", async () => {
    const builders = new Map<string, number>([
      [TOP, 100],
      [SUB_ALLOWED, 10],
    ]);
    const builder: Builder = { b: TOP, f: 20, s: [{ b: SUB_ALLOWED, s: 11 }] };
    const error = requireValidationError(
      await rejectionOf(() => clientFor(builders).order(orderWithBuilder(builder))),
    );
    expect(error.path).toBe("builder.s[0].s");
    expect(error.message).toContain("<= 10");
  });

  test("a sub fee sum above the top-level fee is rejected", async () => {
    const builders = new Map<string, number>([
      [TOP, 100],
      [SUB_ALLOWED, 10],
      [SUB_OTHER, 10],
    ]);
    const builder: Builder = {
      b: TOP,
      f: 15,
      s: [
        { b: SUB_ALLOWED, s: 10 },
        { b: SUB_OTHER, s: 10 },
      ],
    };
    const error = requireValidationError(
      await rejectionOf(() => clientFor(builders).order(orderWithBuilder(builder))),
    );
    expect(error.path).toBe("builder.s");
    expect(error.message).toContain("sum <= builder.f (15)");
  });

  test("a fully allowlisted builder set within the top-level fee passes", async () => {
    const builders = new Map<string, number>([
      [TOP, 100],
      [SUB_ALLOWED, 10],
      [SUB_OTHER, 10],
    ]);
    const builder: Builder = {
      b: TOP,
      f: 10,
      s: [
        { b: SUB_ALLOWED, s: 4 },
        { b: SUB_OTHER, s: 5 },
      ],
    };
    const result = await clientFor(builders).order(orderWithBuilder(builder));
    expect(result.status).toBe("ok");
  });
});

describe("response type mismatch", () => {
  test("a default response to an order is rejected", async () => {
    const client = new ExchangeClient({
      transport: new FakeTransport({ status: "ok", response: { type: "default" } }),
      signer,
    });
    expect(await rejectionOf(() => client.order(orderAction()))).toBeInstanceOf(ExchangeError);
  });

  test("a default response to updateLeverage resolves", async () => {
    const client = new ExchangeClient({
      transport: new FakeTransport({ status: "ok", response: { type: "default" } }),
      signer,
    });
    const result = await client.updateLeverage({ asset: 0, isCross: true, leverage: 10 });
    expect(result.status).toBe("ok");
  });

  test("an order response to an order resolves", async () => {
    const client = new ExchangeClient({
      transport: new FakeTransport(ORDER_RESPONSE),
      signer,
    });
    const result = await client.order(orderAction());
    expect(result.status).toBe("ok");
  });
});
